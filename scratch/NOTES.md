Notes
=====
### Development Workflow
- edit proto file(s)
- generate SQL from proto(s)
    - execute it on dev
- generate CRUD from proto(s)
    - compile/run on dev

### Deployment Workflow
- propose pull request containing:
    - proto file(s) changes
    - generated CRUD changes
    - other manual changes
    - generated SQL
- once changes are approved:
    - execute the generated SQL on production
    - merge the PR into master (what about commit ID in SQL?)
    - deploy the affected artifacts (e.g. services)
