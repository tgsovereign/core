"""Allow running with `python -m helper`."""
import asyncio
from helper.main import main

asyncio.run(main())
