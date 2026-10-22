insert into public.skills (name) values
('Python'), ('SQL'), ('AI'), ('Design'), ('Web development'), ('React'),
('TypeScript'), ('Data engineering'), ('Documentation'), ('Automation')
on conflict (lower(name)) do nothing;
