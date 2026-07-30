import subprocess
import os
import sys
import tempfile
import json
import time
import signal
import shutil
from pathlib import Path


class TaskSandbox:
    MAX_MEMORY_MB = 512
    MAX_CPU_SECONDS = 30
    MAX_FILE_SIZE_MB = 10
    ALLOWED_NETWORK_HOSTS: list[str] = []

    def __init__(self, task_payload: dict, work_dir: str):
        self.payload = task_payload
        self.work_dir = Path(work_dir)
        self.result_file = self.work_dir / "result.json"

    def execute(self) -> dict:
        start_time = time.time()

        try:
            self._prepare_workspace()
            self._write_input()
            self._set_resource_limits()

            result = self._run_subprocess()

            elapsed = time.time() - start_time
            result["execution_time_seconds"] = round(elapsed, 3)

            if self._validate_output(result):
                return {"status": "ok", "result": result}
            else:
                return {"status": "validation_failed", "result": result}

        except subprocess.TimeoutExpired:
            return {"status": "timeout", "error": f"Execution exceeded {self.MAX_CPU_SECONDS}s"}
        except Exception as e:
            return {"status": "error", "error": str(e)}
        finally:
            self._cleanup()

    def _prepare_workspace(self):
        self.work_dir.mkdir(parents=True, exist_ok=True)

    def _write_input(self):
        input_file = self.work_dir / "input.json"
        with open(input_file, 'w', encoding='utf-8') as f:
            json.dump(self.payload, f, ensure_ascii=False)

    def _set_resource_limits(self):
        try:
            import resource

            max_memory = self.MAX_MEMORY_MB * 1024 * 1024
            resource.setrlimit(resource.RLIMIT_AS, (max_memory, max_memory))

            resource.setrlimit(resource.RLIMIT_CPU, (self.MAX_CPU_SECONDS, self.MAX_CPU_SECONDS + 1))

        except (ImportError, ValueError):
            pass

        os.environ['SANDBOX_NETWORK_ALLOWED'] = ','.join(self.ALLOWED_NETWORK_HOSTS) or 'none'
        os.environ['SANDBOX_MAX_FILES'] = str(self.MAX_FILE_SIZE_MB)

    def _run_subprocess(self) -> dict:
        process = subprocess.run(
            [sys.executable, '-u', str(Path(__file__).parent / 'executor.py')],
            cwd=str(self.work_dir),
            capture_output=True,
            text=True,
            timeout=self.MAX_CPU_SECONDS,
            env={
                **os.environ,
                'SANDBOX_MODE': 'true',
                'PYTHONUNBUFFERED': '1',
            }
        )

        raw_output = process.stdout.strip()
        if raw_output:
            try:
                output_data = json.loads(raw_output)
                output_data["exit_code"] = process.returncode
                output_data["stderr"] = process.stderr.strip()
                return output_data
            except json.JSONDecodeError:
                return {
                    "exit_code": process.returncode,
                    "stdout": raw_output,
                    "stderr": process.stderr.strip(),
                }
        else:
            return {"exit_code": process.returncode, "stderr": process.stderr.strip()}

    def _validate_output(self, result: dict) -> bool:
        if not isinstance(result, dict):
            return False

        required_fields = ["status"]
        for field in required_fields:
            if field not in result:
                return False

        output_str = json.dumps(result, ensure_ascii=False)
        if len(output_str.encode('utf-8')) > self.MAX_FILE_SIZE_MB * 1024 * 1024:
            return False

        return True

    def _cleanup(self):
        try:
            if self.work_dir.exists():
                shutil.rmtree(self.work_dir, ignore_errors=True)
        except Exception:
            pass
