from pydantic import BaseModel


class AnomalyCheckRequest(BaseModel):
    instrument_id: int
    test_type_code: str
    new_value: float
    value_field: str = "error"


class SearchRequest(BaseModel):
    query: str


class ChatRequest(BaseModel):
    message: str
    lang: str = "en"  # "en" | "hi" | "ta"
