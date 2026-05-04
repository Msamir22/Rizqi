-- Persist the pre-auth language choice into the profile row created by the
-- auth.users trigger. The mobile client sends this as user metadata during
-- email signup; invalid/missing values safely fall back to English.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  requested_language public.preferred_language_code;
BEGIN
  requested_language := CASE
    WHEN NEW.raw_user_meta_data->>'preferred_language' IN ('en', 'ar')
      THEN (NEW.raw_user_meta_data->>'preferred_language')::public.preferred_language_code
    ELSE 'en'::public.preferred_language_code
  END;

  INSERT INTO public.profiles (
    user_id,
    display_name,
    avatar_url,
    preferred_language
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url',
    requested_language
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
