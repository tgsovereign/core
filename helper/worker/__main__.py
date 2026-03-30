"""Allow running with `python -m worker`."""
import asyncio
from worker.main import main

asyncio.run(main())
