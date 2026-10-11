# app/sandbox/executor.py
import asyncio
import os
import subprocess
import tempfile
import shutil
from typing import List, Optional
import structlog

from app.config import settings

logger = structlog.get_logger(__name__)
clone_semaphore = asyncio.Semaphore(1)


class SandboxExecutor:
    """
    Secure sandbox for code execution and repository analysis
    """

    def __init__(self):
        self.sandbox_dir: Optional[str] = None

    async def __aenter__(self):
        self.sandbox_dir = tempfile.mkdtemp(prefix="sentinel-sandbox-")
        logger.info("sandbox_created", path=self.sandbox_dir)
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.sandbox_dir:
            await self.destroy()

    async def clone_repo(self, repo_url: str, branch: str = "main") -> str:
        """
        Clone or copy repository to sandbox with security restrictions and fallbacks.
        """
        if not self.sandbox_dir:
            self.sandbox_dir = tempfile.mkdtemp(prefix="sentinel-sandbox-")
            logger.info("sandbox_created", path=self.sandbox_dir)

        repo_path = os.path.join(self.sandbox_dir, "repo")

        # 1. Local filesystem path support
        clean_url = repo_url.strip().removeprefix("file://")
        if os.path.exists(clean_url) and os.path.isdir(clean_url):
            try:
                os.makedirs(repo_path, exist_ok=True)
                logger.info("copying_local_repo", src=clean_url, dst=repo_path)
                await asyncio.to_thread(
                    shutil.copytree,
                    clean_url,
                    repo_path,
                    dirs_exist_ok=True,
                    ignore=shutil.ignore_patterns("node_modules", ".git", "venv", ".venv", "__pycache__", ".next"),
                )
                return repo_path
            except Exception as e:
                logger.error("local_repo_copy_failed", error=str(e))
                raise

        # 2. Check if git is installed on system
        git_executable = shutil.which("git")
        if git_executable:
            if os.path.exists(repo_path):
                shutil.rmtree(repo_path, ignore_errors=True)

            cmd_branch = [
                git_executable,
                "clone",
                "--depth", "1",
                "--branch", branch,
                "--single-branch",
                repo_url,
                repo_path,
            ]
            cmd_default = [
                git_executable,
                "clone",
                "--depth", "1",
                repo_url,
                repo_path,
            ]
            try:
                async with clone_semaphore:
                    completed = await asyncio.to_thread(
                        subprocess.run,
                        cmd_branch,
                        capture_output=True,
                        text=True,
                        check=False,
                    )
                    if completed.returncode != 0:
                        logger.warning("git_branch_clone_failed_trying_default", error=completed.stderr)
                        if os.path.exists(repo_path):
                            shutil.rmtree(repo_path, ignore_errors=True)
                        completed = await asyncio.to_thread(
                            subprocess.run,
                            cmd_default,
                            capture_output=True,
                            text=True,
                            check=False,
                        )

                if completed.returncode == 0 and os.path.exists(repo_path) and os.listdir(repo_path):
                    logger.info("repo_cloned", path=repo_path, branch=branch)
                    return repo_path
                else:
                    logger.warning("git_clone_failed_attempting_fallback", error=completed.stderr)
            except Exception as e:
                logger.warning("git_clone_exception_attempting_fallback", error=str(e))

        # 3. HTTP Zip fallback for GitHub repositories if git is not installed or failed
        if "github.com" in repo_url:
            import zipfile
            import io
            import httpx

            # Clean repo_url: e.g. https://github.com/owner/repo.git -> https://github.com/owner/repo
            cleaned_repo = repo_url.rstrip("/").removesuffix(".git")
            zip_urls = [
                f"{cleaned_repo}/archive/refs/heads/{branch}.zip",
                f"{cleaned_repo}/archive/refs/heads/main.zip",
                f"{cleaned_repo}/archive/refs/heads/master.zip",
                f"{cleaned_repo}/archive/HEAD.zip",
            ]

            for z_url in zip_urls:
                try:
                    logger.info("downloading_github_zip", url=z_url)
                    async with httpx.AsyncClient(
                        follow_redirects=True,
                        timeout=30.0,
                        headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) SentinelAI/1.0"}
                    ) as client:
                        resp = await client.get(z_url)
                        if resp.status_code == 200 and len(resp.content) > 100:
                            zip_bytes = io.BytesIO(resp.content)
                            with zipfile.ZipFile(zip_bytes) as z:
                                os.makedirs(repo_path, exist_ok=True)
                                z.extractall(self.sandbox_dir)
                                top_level_dir = z.namelist()[0].split("/")[0] if z.namelist() else None
                                extracted_folder = os.path.join(self.sandbox_dir, top_level_dir) if top_level_dir else None
                                if extracted_folder and os.path.exists(extracted_folder) and extracted_folder != repo_path:
                                    for item in os.listdir(extracted_folder):
                                        s = os.path.join(extracted_folder, item)
                                        d = os.path.join(repo_path, item)
                                        if os.path.isdir(s):
                                            shutil.copytree(s, d, dirs_exist_ok=True)
                                        else:
                                            shutil.copy2(s, d)
                                    shutil.rmtree(extracted_folder, ignore_errors=True)
                            if os.path.exists(repo_path) and os.listdir(repo_path):
                                logger.info("github_zip_extracted", path=repo_path)
                                return repo_path
                except Exception as zip_err:
                    logger.warning("github_zip_download_failed", url=z_url, error=str(zip_err))

        raise RuntimeError(
            f"Unable to clone or access repository '{repo_url}'. "
            "Git clone was unsuccessful and archive download could not be completed. "
            "Please check network connection or verify repository URL."
        )

    async def read_file(self, file_path: str) -> str:
        """
        Read file content with path validation
        """
        # Support absolute paths returned by list_source_files while rejecting traversal.
        if ".." in file_path:
            logger.warning("path_traversal_attempt", path=file_path)
            raise ValueError("Invalid file path")

        full_path = file_path if os.path.isabs(file_path) else f"{self.sandbox_dir}/{file_path}"

        # Verify absolute paths remain inside a temporary sandbox.
        if self.sandbox_dir and not os.path.abspath(full_path).startswith(os.path.abspath(self.sandbox_dir)):
            raise ValueError("Path outside sandbox")

        try:
            with open(full_path, "r", encoding="utf-8", errors="ignore") as f:
                return f.read()
        except Exception as e:
            logger.warning("file_read_error", path=file_path, error=str(e))
            return ""

    async def list_source_files(self, repo_path: str) -> List[str]:
        """
        List source code files for analysis
        """
        source_extensions = {
            ".py", ".js", ".ts", ".jsx", ".tsx",
            ".java", ".go", ".rb", ".php", ".cs",
            ".c", ".cpp", ".h", ".hpp", ".rs",
            ".scala", ".kt", ".swift", ".sql",
            ".sh", ".bash", ".html", ".htm",
            ".json", ".yaml", ".yml", ".toml", ".ini", ".env",
        }

        source_files = []

        try:
            exclude_dirs = {
                "node_modules", "vendor", "venv", ".venv", "env",
                "__pycache__", "dist", "build", ".next", ".git", "site-packages"
            }
            walk_results = await asyncio.to_thread(lambda: list(os.walk(repo_path)))
            for root, dirs, files in walk_results:
                # Skip hidden and dependency directories (case-insensitive)
                dirs[:] = [d for d in dirs if not d.startswith(".") and d.lower() not in exclude_dirs]
                
                # Check if root path itself is inside an excluded directory
                root_parts = set(os.path.normpath(root).lower().split(os.sep))
                if root_parts & exclude_dirs:
                    continue

                for file in files:
                    _, ext = os.path.splitext(file)
                    if ext.lower() in source_extensions:
                        source_files.append(os.path.join(root, file))

            logger.info("source_files_listed", count=len(source_files))
            return source_files
        except Exception as e:
            logger.error("source_files_list_failed", error=str(e))
            return []

    async def execute_code(self, code: str, language: str, timeout: int = 30) -> str:
        """
        Execute code in sandbox with strict limits
        """
        if not settings.SANDBOX_ENABLED:
            raise RuntimeError("Sandbox execution is disabled")

        # Create temporary file
        fd, temp_path = tempfile.mkstemp(suffix=self.get_extension(language))

        try:
            with os.fdopen(fd, "w") as f:
                f.write(code)

            # Execute based on language
            cmd = self.get_execution_command(language, temp_path)

            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )

            try:
                stdout, stderr = await asyncio.wait_for(
                    process.communicate(),
                    timeout=timeout,
                )
            except asyncio.TimeoutError:
                process.kill()
                logger.warning("code_execution_timeout", language=language)
                raise Exception("Code execution timed out")

            if process.returncode != 0:
                return stderr.decode()

            return stdout.decode()

        finally:
            os.unlink(temp_path)

    def get_extension(self, language: str) -> str:
        ext_map = {
            "python": ".py",
            "javascript": ".js",
            "bash": ".sh",
        }
        return ext_map.get(language, ".txt")

    def get_execution_command(self, language: str, file_path: str) -> List[str]:
        cmd_map = {
            "python": ["python3", file_path],
            "javascript": ["node", file_path],
            "bash": ["bash", file_path],
        }
        return cmd_map.get(language, ["cat", file_path])

    async def destroy(self):
        """
        Destroy sandbox and clean up
        """
        if self.sandbox_dir:
            try:
                await asyncio.to_thread(shutil.rmtree, self.sandbox_dir, ignore_errors=True)
                logger.info("sandbox_destroyed", path=self.sandbox_dir)
            except Exception as e:
                logger.error("sandbox_cleanup_error", error=str(e))
            finally:
                self.sandbox_dir = None


import os