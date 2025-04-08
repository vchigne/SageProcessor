"""Pytest configuration and shared fixtures"""
import os
import pytest
import tempfile
import shutil
from datetime import datetime
from unittest.mock import MagicMock

@pytest.fixture(autouse=True)
def setup_temp_dir():
    """Create and clean up temporary directory for test files"""
    temp_dir = tempfile.mkdtemp(prefix='sage_daemon_test_')
    os.environ['SAGE_DAEMON_TEMP'] = temp_dir
    yield temp_dir
    shutil.rmtree(temp_dir)

@pytest.fixture
def mock_date():
    """Fix datetime.now() for consistent testing"""
    class MockDateTime:
        @classmethod
        def now(cls):
            return datetime(2025, 3, 14, 12, 0, 0)
    return MockDateTime

@pytest.fixture
def sample_files(setup_temp_dir):
    """Create sample files for testing"""
    files = []
    for name in ['test1.csv', 'test2.xlsx', 'test3.zip']:
        path = os.path.join(setup_temp_dir, name)
        with open(path, 'w') as f:
            f.write('test data')
        files.append(path)
    return files
