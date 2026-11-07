"""
Pagos con timeouts "en el ultimo milisegundo": estrategia ingenua vs segura.
Ejecuta:  python payment_flow.py

En produccion: tabla payments con UNIQUE(reference), estados explicitos, outbox y un job de
conciliacion contra el archivo de liquidacion del adquirente. Dinero en centavos (int) o Decimal.
"""
import random


class Timeout(Exception):
    pass


class Unavailable(Exception):
    pass


class Acquirer:
    """Banco adquirente simulado: deduplica por referencia (como Idempotency-Key)."""

    def __init__(self):
        self.settled = {}  # archivo de liquidacion: ref -> centavos
        self.rnd = random.Random(42)
        self.calls = 0

    def charge(self, ref, cents):
        self.calls += 1
        r = self.rnd.random()
        if r < 0.12:
            raise Timeout()  # la peticion se perdio: NO cobro
        self.settled.setdefault(ref, cents)
        if r < 0.32:
            raise Timeout()  # cobro, pero la respuesta se perdio
        return True

    def status(self, ref):
        if self.rnd.random() < 0.45:
            raise Unavailable()
        return self.settled.get(ref)


orders = [(f"ord-{i}", 1000 + i * 25) for i in range(1, 41)]
expected = sum(c for _, c in orders)

# ---------------- Ingenua ----------------
a1 = Acquirer()
for oid, cents in orders:
    attempt = 0
    while True:
        attempt += 1
        try:
            a1.charge(f"{oid}-try{attempt}", cents)  # referencia nueva en cada intento
            break
        except Timeout:
            pass  # "fallo" -> el cliente paga otra vez
charged1 = sum(a1.settled.values())
print("=== Ingenua (timeout = fallido, referencia nueva) ===")
print(f"  esperado ${expected / 100:,.2f} | cobrado ${charged1 / 100:,.2f} | DOBLES CARGOS ${(charged1 - expected) / 100:,.2f}\n")

# ---------------- Segura ----------------
a2 = Acquirer()
payments = {}
ledger = []  # (cuenta, centavos): doble partida
for oid, cents in orders:
    payments[oid] = "PENDING"
    for _ in range(2):
        if payments[oid] != "PENDING":
            break
        try:
            a2.charge(oid, cents)  # la MISMA referencia en cada intento
            payments[oid] = "CAPTURED"
        except Timeout:
            try:
                if a2.status(oid) is not None:
                    payments[oid] = "CAPTURED"
                # si no esta, la peticion nunca llego: reintentar con la misma ref es seguro
            except Unavailable:
                pass
    if payments[oid] == "CAPTURED":
        ledger += [("cliente", -cents), ("comercio", cents)]

pending = sum(1 for s in payments.values() if s == "PENDING")
fixed = failed = 0
for oid, cents in orders:  # conciliacion T+1
    if payments[oid] != "PENDING":
        continue
    if oid in a2.settled:
        payments[oid] = "CAPTURED"
        ledger += [("cliente", -cents), ("comercio", cents)]
        fixed += 1
    else:
        payments[oid] = "FAILED"  # ahora si es seguro decir "fallo, reintenta"
        failed += 1

captured = sum(c for oid, c in orders if payments[oid] == "CAPTURED")
charged2 = sum(a2.settled.values())
merchant = sum(c for acc, c in ledger if acc == "comercio")
print("=== Segura (misma referencia + PENDIENTE + consulta + conciliacion) ===")
print(f"  llamadas {a2.calls} | pendientes tras reintentos {pending} | conciliacion: {fixed} capturados, {failed} fallidos de verdad")
print(f"  capturado ${captured / 100:,.2f} | cobrado por el banco ${charged2 / 100:,.2f} | dobles cargos ${(charged2 - captured) / 100:,.2f}")
print(f"  ledger: comercio ${merchant / 100:,.2f} | suma de asientos = {sum(c for _, c in ledger)} (siempre 0)")
