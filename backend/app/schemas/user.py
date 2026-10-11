# app/schemas/user.py
from enum import Enum


class AppRole(str, Enum):
    VIEWER = "Viewer"
    ENGINEER = "Engineer"
    CISO = "CISO"
    SUPERADMIN = "Superadmin"
