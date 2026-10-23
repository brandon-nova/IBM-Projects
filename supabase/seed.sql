insert into public.skills (name) values
('Python'), ('SQL'), ('AI'), ('Design'), ('Web development'), ('React'),
('TypeScript'), ('Data engineering'), ('Documentation'), ('Automation'),
('JavaScript'),('Java'),('Go'),('C#'),('C++'),('Bash'),('R'),('HTML'),('CSS'),
('Node.js'),('Next.js'),('Angular'),('Vue.js'),('REST APIs'),('GraphQL'),
('PostgreSQL'),('Db2'),('MongoDB'),('Data analysis'),('Data visualization'),('Excel'),
('Power BI'),('Tableau'),('Machine learning'),('Generative AI'),('watsonx'),
('UX design'),('UI design'),('User research'),('Accessibility'),('Technical writing'),
('Testing'),('Quality assurance'),('Git'),('Docker'),('Kubernetes'),('OpenShift'),
('CI/CD'),('Terraform'),('IBM Cloud'),('AWS'),('Azure'),('Google Cloud'),('Linux'),
('Cybersecurity'),('Project coordination'),('Agile'),('Facilitation'),('Public speaking')
on conflict (lower(name)) do nothing;
