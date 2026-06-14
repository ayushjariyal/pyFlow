"""Service layer.

Holds both the DB/business-logic service (`job_service`) and the per-type
data-processing modules (csv_analysis, data_cleaning, ...).

Intentionally does NOT eagerly import `job_service` here: it imports
`app.tasks.process_job`, and the tasks package imports the processing service
modules from this package — eager re-export would create an import cycle. Import
what you need directly, e.g. `from app.services.job_service import JobService`.
"""
