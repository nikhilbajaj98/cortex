-- Create events table for CortexEvent storage
-- Fields correspond to src/types/event.ts

CREATE TABLE IF NOT EXISTS events (
  id BIGSERIAL PRIMARY KEY,
  type TEXT NOT NULL,
  service TEXT NOT NULL,
  status INTEGER NOT NULL,
  latency INTEGER NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  metadata JSONB,
  ip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Helpful indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_events_service ON events(service);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);


