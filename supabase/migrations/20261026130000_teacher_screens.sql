-- Fields shown on the teacher screens T01 to T03.

-- Sidebar: "Q. Dobbelaere · Sint-Lievenscollege"
alter table public.teacher add column school text not null default '';

-- Recent sessions: "2B · 7 groepen"
alter table public.session add column class_label text not null default '';

-- "Foto verplicht: de groep op de foto, met de toren erachter"
alter table public.question add column photo_prompt text;
