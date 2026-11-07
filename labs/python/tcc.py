"""
TCC (Try-Confirm-Cancel) + Transactional Outbox, sin frameworks.
Ejecuta:  python tcc.py
"""


class Wallet:
    """Participante TCC: idempotente y tolerante al desorden de mensajes."""

    def __init__(self):
        self.available, self.frozen = 500, 0
        self.log = {}  # tabla tcc_tx: tx -> estado
        self.outbox = []  # misma transaccion que el saldo

    def try_(self, tx, amount):
        st = self.log.get(tx)
        if st in ("CANCELLED", "EMPTY_CANCELLED"):
            return "rechazado (anti-suspension)"
        if st:
            return "ignorado (Try duplicado)"
        if self.available < amount:
            return "rechazado (fondos insuficientes)"
        self.available -= amount
        self.frozen += amount
        self.log[tx] = "TRIED"
        return f"congelados ${amount}"

    def confirm(self, tx, amount):
        if self.log.get(tx) != "TRIED":
            return f"ignorado ({self.log.get(tx)})"
        self.frozen -= amount
        self.log[tx] = "CONFIRMED"
        self.outbox.append({"event": "WalletDebited", "tx": tx, "amount": amount})
        return f"descontados ${amount}"

    def cancel(self, tx, amount):
        st = self.log.get(tx)
        if st is None:
            self.log[tx] = "EMPTY_CANCELLED"
            return "cancelacion vacia registrada"
        if st != "TRIED":
            return f"ignorado ({st})"
        self.frozen -= amount
        self.available += amount
        self.log[tx] = "CANCELLED"
        return f"liberados ${amount}"


w = Wallet()
msgs = [("try", "T1", 100), ("confirm", "T1", 100), ("confirm", "T1", 100),
        ("cancel", "T2", 70), ("try", "T2", 70), ("try", "T3", 600),
        ("try", "T4", 150), ("cancel", "T4", 150), ("cancel", "T4", 150)]
print("=== Participante TCC: billetera (saldo inicial $500) ===")
for op, tx, amt in msgs:
    r = {"try": w.try_, "confirm": w.confirm, "cancel": w.cancel}[op](tx, amt)
    print(f"  {op.upper():8} {tx:3} ${amt:<4} -> {r:36} disponible={w.available} congelado={w.frozen}")

print("\n=== Outbox: entrega al menos una vez + inbox con deduplicacion ===")
inbox = set()
delivered = w.outbox + w.outbox  # el relay reintento tras caerse
applied = 0
for ev in delivered:
    key = (ev["event"], ev["tx"])
    if key not in inbox:
        inbox.add(key)
        applied += 1
print(f"  entregados {len(delivered)}, aplicados {applied}, duplicados descartados {len(delivered) - applied}")
