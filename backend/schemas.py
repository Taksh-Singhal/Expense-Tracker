from pydantic import BaseModel
from typing import Optional


class ExpenseBase(BaseModel):
    title: str
    amount: float
    category: str
    date: str


class ExpenseCreate(ExpenseBase):
    pass


class ExpenseResponse(ExpenseBase):
    id: int

    class Config:
        from_attributes = True


class ExpensePostResponse(BaseModel):
    message: str
    id: int


class ExpenseDeleteResponse(BaseModel):
    message: str


class PredictRequest(BaseModel):
    text: str


class PredictResponse(BaseModel):
    predicted_category: str
    confidence: Optional[float] = None


class CompareResponse(BaseModel):
    message: str

