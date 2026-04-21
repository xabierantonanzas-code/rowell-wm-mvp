-- ============================================================================
-- Migration 008: RLS policies for documents, meetings, messages
-- ============================================================================
-- These tables were created without RLS policies. This migration adds
-- proper row-level security to prevent cross-client data access.
--
-- Apply via Supabase SQL Editor (DDL cannot run via REST API).

-- ---- DOCUMENTS ----
ALTER TABLE IF EXISTS public.documents ENABLE ROW LEVEL SECURITY;

-- Admin/owner can do everything
CREATE POLICY "Admin full access on documents"
  ON public.documents FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = auth.uid()
        AND (u.raw_app_meta_data->>'role') IN ('admin', 'owner')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = auth.uid()
        AND (u.raw_app_meta_data->>'role') IN ('admin', 'owner')
    )
  );

-- Client can view own documents
CREATE POLICY "Client can view own documents"
  ON public.documents FOR SELECT
  USING (
    client_id IN (
      SELECT c.id FROM public.clients c
      WHERE c.email = auth.jwt() ->> 'email'
    )
  );

-- ---- MEETINGS ----
ALTER TABLE IF EXISTS public.meetings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on meetings"
  ON public.meetings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = auth.uid()
        AND (u.raw_app_meta_data->>'role') IN ('admin', 'owner')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = auth.uid()
        AND (u.raw_app_meta_data->>'role') IN ('admin', 'owner')
    )
  );

CREATE POLICY "Client can view own meetings"
  ON public.meetings FOR SELECT
  USING (
    client_id IN (
      SELECT c.id FROM public.clients c
      WHERE c.email = auth.jwt() ->> 'email'
    )
  );

-- ---- MESSAGES ----
ALTER TABLE IF EXISTS public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on messages"
  ON public.messages FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = auth.uid()
        AND (u.raw_app_meta_data->>'role') IN ('admin', 'owner')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = auth.uid()
        AND (u.raw_app_meta_data->>'role') IN ('admin', 'owner')
    )
  );

CREATE POLICY "Client can view own messages"
  ON public.messages FOR SELECT
  USING (
    client_id IN (
      SELECT c.id FROM public.clients c
      WHERE c.email = auth.jwt() ->> 'email'
    )
  );

-- Client can insert own messages (for chat)
CREATE POLICY "Client can send own messages"
  ON public.messages FOR INSERT
  WITH CHECK (
    client_id IN (
      SELECT c.id FROM public.clients c
      WHERE c.email = auth.jwt() ->> 'email'
    )
  );
