from sqlalchemy import Column, Integer, String, Float, Boolean
from backend.database import Base


class Resource(Base):
    __tablename__ = "resources"

    id                 = Column(Integer, primary_key=True, index=True)
    resource_id        = Column(String,  nullable=False)
    resource_type      = Column(String,  nullable=False)
    region             = Column(String,  nullable=False)
    cost               = Column(Float,   nullable=False)
    runtime_hours      = Column(Float,   nullable=False)
    cpu_utilization    = Column(Float,   nullable=False)
    memory_utilization = Column(Float,   nullable=False)
    cluster            = Column(Integer, nullable=True)
    anomaly            = Column(Boolean, nullable=True)