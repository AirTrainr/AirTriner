-- Update Founding 50 grant RPC to give 1 year (365 days) instead of 6 months (180 days).
CREATE OR REPLACE FUNCTION public.grant_founding_50(p_user_id uuid)
RETURNS TABLE(status text, current_count integer, profile_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_profile_id uuid;
    v_already boolean;
    v_count integer;
BEGIN
    SELECT id, is_founding_50
      INTO v_profile_id, v_already
      FROM trainer_profiles
     WHERE user_id = p_user_id
     FOR UPDATE;

    IF v_profile_id IS NULL THEN
        RETURN QUERY SELECT 'not_found'::text, 0, NULL::uuid;
        RETURN;
    END IF;

    IF v_already THEN
        SELECT COUNT(*)::int INTO v_count FROM trainer_profiles WHERE is_founding_50 = TRUE;
        RETURN QUERY SELECT 'already'::text, v_count, v_profile_id;
        RETURN;
    END IF;

    SELECT COUNT(*)::int INTO v_count FROM trainer_profiles WHERE is_founding_50 = TRUE;
    IF v_count >= 50 THEN
        RETURN QUERY SELECT 'cap_reached'::text, v_count, v_profile_id;
        RETURN;
    END IF;

    UPDATE trainer_profiles
       SET is_founding_50 = TRUE,
           founding_50_granted_at = NOW(),
           subscription_status = 'active',
           subscription_expires_at = NOW() + INTERVAL '365 days'
     WHERE id = v_profile_id;

    SELECT COUNT(*)::int INTO v_count FROM trainer_profiles WHERE is_founding_50 = TRUE;
    RETURN QUERY SELECT 'granted'::text, v_count, v_profile_id;
END;
$$;

REVOKE ALL ON FUNCTION public.grant_founding_50(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.grant_founding_50(uuid) TO service_role;
