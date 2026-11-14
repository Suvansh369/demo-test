-- ========================================================
-- NIRVAIR CIVIC INTELLIGENCE PLATFORM - SUPABASE SCHEMA
-- Target Project: https://supabase.com/dashboard/project/ymfyrxojlxxycjqdmixb
-- Run this script in your Supabase SQL Editor to initialize all tables & policies
-- ========================================================

-- 1. CITIZEN REPORTS TABLE
CREATE TABLE IF NOT EXISTS public.citizen_reports (
  id TEXT PRIMARY KEY,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  locality TEXT NOT NULL,
  report_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'moderate',
  description TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'pending'
);

-- Enable Row Level Security and configure anonymous access policies
ALTER TABLE public.citizen_reports ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public read on citizen_reports') THEN
    CREATE POLICY "Allow public read on citizen_reports" ON public.citizen_reports FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public insert on citizen_reports') THEN
    CREATE POLICY "Allow public insert on citizen_reports" ON public.citizen_reports FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public update on citizen_reports') THEN
    CREATE POLICY "Allow public update on citizen_reports" ON public.citizen_reports FOR UPDATE USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public delete on citizen_reports') THEN
    CREATE POLICY "Allow public delete on citizen_reports" ON public.citizen_reports FOR DELETE USING (true);
  END IF;
END $$;

-- 2. INTERVENTIONS TABLE
CREATE TABLE IF NOT EXISTS public.interventions (
  id TEXT PRIMARY KEY,
  locality TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'citizen',
  title TEXT NOT NULL,
  timeframe TEXT NOT NULL DEFAULT 'immediate',
  rationale TEXT,
  evidence TEXT,
  assigned_to TEXT DEFAULT 'Unassigned',
  deadline DATE,
  status TEXT NOT NULL DEFAULT 'proposed',
  notes TEXT,
  verification_method TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

ALTER TABLE public.interventions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public read on interventions') THEN
    CREATE POLICY "Allow public read on interventions" ON public.interventions FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public insert on interventions') THEN
    CREATE POLICY "Allow public insert on interventions" ON public.interventions FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public update on interventions') THEN
    CREATE POLICY "Allow public update on interventions" ON public.interventions FOR UPDATE USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public delete on interventions') THEN
    CREATE POLICY "Allow public delete on interventions" ON public.interventions FOR DELETE USING (true);
  END IF;
END $$;

-- 3. AQI HISTORY SNAPSHOTS TABLE
CREATE TABLE IF NOT EXISTS public.aqi_history (
  id TEXT PRIMARY KEY,
  locality TEXT NOT NULL,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  aqi INTEGER NOT NULL,
  category TEXT NOT NULL,
  pm25 DOUBLE PRECISION,
  pm10 DOUBLE PRECISION,
  station_name TEXT,
  station_distance_km DOUBLE PRECISION,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.aqi_history ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public read on aqi_history') THEN
    CREATE POLICY "Allow public read on aqi_history" ON public.aqi_history FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public insert on aqi_history') THEN
    CREATE POLICY "Allow public insert on aqi_history" ON public.aqi_history FOR INSERT WITH CHECK (true);
  END IF;
END $$;

-- 4. UPLOADED DATASETS TABLE
CREATE TABLE IF NOT EXISTS public.datasets (
  id TEXT PRIMARY KEY,
  file_name TEXT NOT NULL,
  total_records INTEGER NOT NULL,
  analyzed_parameter TEXT NOT NULL,
  trust_breakdown JSONB,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.datasets ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public read on datasets') THEN
    CREATE POLICY "Allow public read on datasets" ON public.datasets FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public insert on datasets') THEN
    CREATE POLICY "Allow public insert on datasets" ON public.datasets FOR INSERT WITH CHECK (true);
  END IF;
END $$;

-- 5. SEED INITIAL BASELINE INTERVENTIONS
INSERT INTO public.interventions (id, locality, role, title, timeframe, rationale, evidence, assigned_to, deadline, status, notes, verification_method, created_at)
VALUES 
  ('int-init-1', 'Anand Vihar, Delhi', 'ward_officer', 'Deploy Anti-Smog Gun & Wet Sweeping', 'immediate', 'Elevated PM10 readings due to heavy unpaved shoulder dust and bus movement.', 'PM10 concentration 280 ug/m3; Anand Vihar CAAQMS shows Poor category.', 'Sanitation Division East, MCD', CURRENT_DATE + 2, 'in_progress', 'Water misting truck scheduled for twice-daily runs between 7 AM and 3 PM.', 'GPS track logs from water tanker and hourly CAAQMS PM10 trend comparison.', NOW() - INTERVAL '2 days'),
  ('int-init-2', 'Vasant Vihar, Delhi', 'school', 'Shift Morning Physical Assembly to Indoor Auditorium', 'immediate', 'AQI exceeding 220 (Poor) during morning inversion peak (7:30 - 9:00 AM).', 'Morning particulate peak recorded at 245 AQI; health advisory for pediatric respiratory protection.', 'Vice Principal & Sports Director', CURRENT_DATE, 'completed', 'Indoor air purifiers operating in gym and auditorium; sports sessions postponed to post-noon.', 'Daily log verified by school administration; parent notification dispatched.', NOW() - INTERVAL '4 days')
ON CONFLICT (id) DO NOTHING;
