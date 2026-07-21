from typing import Optional

class Cache:
    def __init__(self, max_size: int = 100):
        self._store: dict = {}
        self._max_size = max_size

    def get(self, key: str) -> Optional[str]:
        return self._store.get(key)

    def set(self, key: str, value: str) -> None:
        if len(self._store) >= self._max_size:
            self._store.pop(next(iter(self._store)))
        self._store[key] = value

    def clear(self) -> None:
        self._store.clear()

    @property
    def size(self) -> int:
        return len(self._store)
