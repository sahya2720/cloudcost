from typing import Optional
from pydantic import BaseModel


class ResourceResponse(BaseModel):
    id:                 int
    resource_id:        str
    resource_type:      str
    region:             str
    cost:               float
    runtime_hours:      float
    cpu_utilization:    float
    memory_utilization: float
    cluster:            Optional[int]  = None
    anomaly:            Optional[bool] = None

    model_config = {"from_attributes": True}


class RecommendationResponse(BaseModel):
    resource_id:        str
    resource_type:      str
    region:             str
    issue:              str
    suggestion:         str
    cost:               float
    cluster:            Optional[int]   = None
    anomaly:            Optional[bool]  = None
    cpu_utilization:    Optional[float] = None
    memory_utilization: Optional[float] = None
    runtime_hours:      Optional[float] = None