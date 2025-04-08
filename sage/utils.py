"""Utility functions for SAGE"""
import os
import uuid
import shutil
from typing import Tuple
from datetime import datetime

def create_execution_directory() -> Tuple[str, str]:
    """Create a new execution directory with UUID and return its path"""
    execution_uuid = str(uuid.uuid4())
    base_dir = os.path.join(os.getcwd(), "executions")
    execution_dir = os.path.join(base_dir, execution_uuid)

    os.makedirs(execution_dir, exist_ok=True)
    return execution_dir, execution_uuid

def copy_input_files(execution_dir: str, yaml_path: str, data_path: str) -> Tuple[str, str]:
    """Copy input files to execution directory and return new paths"""
    yaml_dest = os.path.join(execution_dir, "input.yaml")
    # Preservar la extensión original del archivo de datos
    _, ext = os.path.splitext(data_path)
    data_dest = os.path.join(execution_dir, f"data{ext}")

    shutil.copy2(yaml_path, yaml_dest)
    shutil.copy2(data_path, data_dest)

    return yaml_dest, data_dest

def get_timestamp() -> str:
    """Get current timestamp in standard format"""
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")