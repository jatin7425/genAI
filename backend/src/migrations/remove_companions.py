"""Delete the retired feature's dedicated collections, and no other data."""
COLLECTIONS = ("companion_profiles", "companion_threads", "companion_images")


def purge_retired_data(db):
    existing = set(db.list_collection_names())
    dropped = []
    for name in COLLECTIONS:
        if name in existing:
            db.drop_collection(name)
            dropped.append(name)
    if set(COLLECTIONS).intersection(db.list_collection_names()):
        raise RuntimeError("Retired feature database cleanup did not finish.")
    return dropped


if __name__ == "__main__":
    from src.config import CONFIG  # Loads the configured environment without starting the API.
    from src.db import get_db
    dropped = purge_retired_data(get_db())
    print("Dropped retired collections: " + (", ".join(dropped) or "none; already absent"))
