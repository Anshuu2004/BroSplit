-- Make handle_new_user resilient to OAuth provider metadata.
-- Google sends `name` + `picture`; email signup sends `full_name` + `avatar_url`.
-- Also start storing the avatar URL.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    INSERT INTO public.users (id, email, full_name, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(
            NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
            NULLIF(NEW.raw_user_meta_data->>'name', ''),
            split_part(NEW.email, '@', 1)
        ),
        COALESCE(
            NULLIF(NEW.raw_user_meta_data->>'avatar_url', ''),
            NULLIF(NEW.raw_user_meta_data->>'picture', '')
        )
    );
    RETURN NEW;
END;
$$;
