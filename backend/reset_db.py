from database import SessionLocal
from models import Expense  # or whatever your model is named

db = SessionLocal()
try:
    num_rows_deleted = db.query(Expense).delete()
    db.commit()
    print(f"Successfully deleted {num_rows_deleted} expenses.")
except Exception as e:
    db.rollback()
    print(f"An error occurred: {e}")
finally:
    db.close()