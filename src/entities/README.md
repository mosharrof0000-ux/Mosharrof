# Entity layer

Every meaningful Mosharrof component should be representable through the
EntityContract. Entity-specific implementation belongs in its own folder;
shared governance stays in src/core.

The registry is the source of truth for discovering entities.
