"""
SQL real con sqlite3 (incluido en Python): EXPLAIN, indices compuestos y bloqueo optimista.
Ejecuta:  python locking.py

En PostgreSQL usarias EXPLAIN (ANALYZE, BUFFERS) y en MySQL EXPLAIN ANALYZE; la idea es la misma.
"""
import random
import sqlite3
import time

db = sqlite3.connect(":memory:")
db.execute("""CREATE TABLE payments (
  id INTEGER PRIMARY KEY, merchant_id TEXT, status TEXT, amount_cents INTEGER, created_at INTEGER)""")
rnd = random.Random(7)
statuses = ["CAPTURED"] * 7 + ["FAILED", "REFUNDED", "PENDING"]
rows = [(f"m_{rnd.randint(1, 2000)}", rnd.choice(statuses), rnd.randint(100, 50_000), 1_700_000_000 + i) for i in range(300_000)]
db.executemany("INSERT INTO payments (merchant_id, status, amount_cents, created_at) VALUES (?,?,?,?)", rows)
db.commit()

Q = """SELECT id, amount_cents FROM payments
       WHERE merchant_id = 'm_42' AND status = 'CAPTURED'
       ORDER BY created_at DESC LIMIT 50"""


def plan(sql):
    return " | ".join(r[3] for r in db.execute("EXPLAIN QUERY PLAN " + sql))


def timed(sql, n=20):
    t0 = time.perf_counter()
    for _ in range(n):
        db.execute(sql).fetchall()
    return (time.perf_counter() - t0) / n * 1000


print("=== 1) Sin indice ===")
print("  plan:", plan(Q))
print(f"  tiempo: {timed(Q):.2f} ms  (recorre las 300.000 filas: 'SCAN' = Seq Scan)")

print("\n=== 2) Indice solo por status (mala seleccion: 70% de las filas son CAPTURED) ===")
db.execute("CREATE INDEX idx_status ON payments(status)")
print("  plan:", plan(Q))
print(f"  tiempo: {timed(Q):.2f} ms")
db.execute("DROP INDEX idx_status")

print("\n=== 3) Indice compuesto (igualdades primero, luego la columna de orden) ===")
db.execute("CREATE INDEX idx_m_s_c ON payments(merchant_id, status, created_at)")
print("  plan:", plan(Q))
print(f"  tiempo: {timed(Q):.3f} ms  (lee solo ~50 entradas del indice, ya ordenadas)")

print("\n=== 4) Regla del prefijo izquierdo ===")
print("  WHERE merchant_id = ?        ->", plan("SELECT id FROM payments WHERE merchant_id = 'm_42'"))
print("  WHERE status = ? (sin merchant) ->", plan("SELECT id FROM payments WHERE status = 'FAILED'"))
print("  funcion sobre la columna       ->", plan("SELECT id FROM payments WHERE lower(merchant_id) = 'm_42'"))

print("\n=== 5) Bloqueo optimista con columna version ===")
db.execute("CREATE TABLE accounts (id INTEGER PRIMARY KEY, balance_cents INTEGER, version INTEGER)")
db.execute("INSERT INTO accounts VALUES (1, 10000, 0)")
# dos "sesiones" leen la misma version
bal_a, ver_a = db.execute("SELECT balance_cents, version FROM accounts WHERE id=1").fetchone()
bal_b, ver_b = db.execute("SELECT balance_cents, version FROM accounts WHERE id=1").fetchone()
upd = "UPDATE accounts SET balance_cents=?, version=version+1 WHERE id=1 AND version=?"
a = db.execute(upd, (bal_a - 3000, ver_a)).rowcount
b = db.execute(upd, (bal_b - 5000, ver_b)).rowcount
print(f"  sesion A actualiza: {a} fila | sesion B actualiza: {b} filas -> B debe releer y reintentar (OptimisticLockException)")
bal_b, ver_b = db.execute("SELECT balance_cents, version FROM accounts WHERE id=1").fetchone()
db.execute(upd, (bal_b - 5000, ver_b))
print("  saldo final:", db.execute("SELECT balance_cents, version FROM accounts").fetchone(), "(10000 - 3000 - 5000 = 2000, sin lost update)")

print("\n=== 6) Descuento atomico con condicion (lo mas simple) ===")
ok = db.execute("UPDATE accounts SET balance_cents = balance_cents - 2500 WHERE id=1 AND balance_cents >= 2500").rowcount
print(f"  retirar 2500 con saldo 2000 -> filas afectadas: {ok} (fondos insuficientes, sin leer antes)")
print("  Pesimista en Postgres/MySQL: SELECT ... FOR UPDATE (SQLite bloquea la base entera con BEGIN IMMEDIATE).")
