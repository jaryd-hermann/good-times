-- =============================================================================
-- v2: new accounts open in light mode
-- =============================================================================
-- v1 was a dark-first app, so users.theme_preference defaulted to 'dark'. v2 is
-- light-first, which meant every new v2 account opened dark no matter what the
-- user or their device had asked for. It looked like the app was following the
-- system appearance; it was not. Nothing in the client reads device appearance
-- at all — ThemeProvider defaults to "light" and is then overwritten by this
-- column, and Info.plist pins UIUserInterfaceStyle to Light.
--
-- Only the default changes. Existing rows are deliberately left alone: 41 of 55
-- users sit on 'dark' and there is no way to distinguish who chose it from who
-- merely inherited it, so rewriting them would silently flip the theme for
-- anyone who picked dark on purpose.
-- =============================================================================

ALTER TABLE public.users ALTER COLUMN theme_preference SET DEFAULT 'light';
