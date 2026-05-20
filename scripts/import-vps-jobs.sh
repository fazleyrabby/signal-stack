#!/bin/bash
# Export jobs from VPS and import into local Docker Postgres

set -e

# =====================
# EXPORT & IMPORT JOBS
# =====================
echo "📤 Exporting jobs from VPS as JSON..."

ssh signalstack "
  docker exec signalstack-db psql -U signal -d signalstack -t --single-transaction -c \"
    SELECT json_agg(json_build_object(
      'id', gen_random_uuid(),
      'source_id', null,
      'source', source,
      'title', title,
      'company', COALESCE(company, ''),
      'location', COALESCE(location, ''),
      'remote', COALESCE(remote, false),
      'job_type', COALESCE(job_type, ''),
      'salary_range', COALESCE(salary_range, ''),
      'experience_level', COALESCE(experience_level, ''),
      'description', COALESCE(description, ''),
      'url', url,
      'hash', hash,
      'content_hash', COALESCE(content_hash, hash),
      'tags', COALESCE(tags, '[]'::jsonb),
      'published_at', COALESCE(published_at, now()),
      'created_at', now()
    ))::text FROM jobs;
  \"
" > /tmp/jobs_export.json

echo "✅ Exported $(wc -l < /tmp/jobs_export.json) jobs ($(wc -c < /tmp/jobs_export.json) bytes)"

# Copy jobs to container
docker compose cp /tmp/jobs_export.json postgres:/tmp/jobs_export.json

# Import jobs
echo "📥 Importing jobs into local DB..."
docker compose exec -T postgres psql -U signal -d signalstack -c "
DO \$\$
DECLARE
  job_data jsonb;
  insert_count integer := 0;
  json_array jsonb;
BEGIN
  json_array := pg_read_file('/tmp/jobs_export.json')::jsonb;
  FOR job_data IN SELECT * FROM jsonb_array_elements(json_array)
  LOOP
    INSERT INTO jobs (
      id, source_id, source, title, company, location, remote,
      job_type, salary_range, experience_level, description,
      url, hash, content_hash, tags, published_at, created_at
    ) VALUES (
      (job_data->>'id')::uuid,
      null,
      job_data->>'source',
      (job_data->>'title')::text,
      job_data->>'company',
      job_data->>'location',
      (job_data->>'remote')::boolean,
      job_data->>'job_type',
      job_data->>'salary_range',
      job_data->>'experience_level',
      (job_data->>'description')::text,
      job_data->>'url',
      job_data->>'hash',
      job_data->>'content_hash',
      COALESCE((job_data->>'tags')::jsonb, '[]'::jsonb),
      COALESCE((job_data->>'published_at')::timestamptz, now()),
      COALESCE((job_data->>'created_at')::timestamptz, now())
    )
    ON CONFLICT (hash) DO NOTHING;
    insert_count := insert_count + 1;
  END LOOP;
  RAISE NOTICE 'Successfully processed % jobs', insert_count;
END;
\$\$
"

# =====================
# EXPORT & IMPORT COMPANIES
# =====================
echo ""
echo "📤 Exporting companies from VPS..."

ssh signalstack "
  docker exec signalstack-db psql -U signal -d signalstack -t --single-transaction -c \"
    SELECT json_agg(json_build_object(
      'id', gen_random_uuid(),
      'name', name,
      'website', COALESCE(website, ''),
      'career_url', COALESCE(career_url, ''),
      'career_page_found', career_page_found,
      'city', COALESCE(city, ''),
      'country', COALESCE(country, ''),
      'lat', lat,
      'lng', lng,
      'osm_id', COALESCE(osm_id, ''),
      'place_id', COALESCE(place_id, ''),
      'source', source,
      'tags', COALESCE(tags, '[]'::jsonb),
      'created_at', now()
    ))::text FROM companies;
  \"
" > /tmp/companies_export.json

echo "✅ Exported $(wc -l < /tmp/companies_export.json) companies ($(wc -c < /tmp/companies_export.json) bytes)"

# Copy companies to container
docker compose cp /tmp/companies_export.json postgres:/tmp/companies_export.json

# Import companies
echo "📥 Importing companies into local DB..."
docker compose exec -T postgres psql -U signal -d signalstack -c "
DO \$\$
DECLARE
  company_data jsonb;
  insert_count integer := 0;
  json_array jsonb;
BEGIN
  json_array := pg_read_file('/tmp/companies_export.json')::jsonb;
  FOR company_data IN SELECT * FROM jsonb_array_elements(json_array)
  LOOP
    INSERT INTO companies (
      id, name, website, career_url, career_page_found,
      city, country, lat, lng, osm_id, place_id, source, tags, created_at
    ) VALUES (
      (company_data->>'id')::uuid,
      company_data->>'name',
      NULLIF(company_data->>'website', ''),
      NULLIF(company_data->>'career_url', ''),
      (company_data->>'career_page_found')::boolean,
      NULLIF(company_data->>'city', ''),
      NULLIF(company_data->>'country', ''),
      NULLIF(company_data->>'lat', '')::numeric,
      NULLIF(company_data->>'lng', '')::numeric,
      NULLIF(company_data->>'osm_id', ''),
      NULLIF(company_data->>'place_id', ''),
      company_data->>'source',
      COALESCE((company_data->>'tags')::jsonb, '[]'::jsonb),
      COALESCE((company_data->>'created_at')::timestamptz, now())
    )
    ON CONFLICT DO NOTHING;
    insert_count := insert_count + 1;
  END LOOP;
  RAISE NOTICE 'Successfully processed % companies', insert_count;
END;
\$\$
"

# =====================
# REPORT
# =====================
echo ""
echo "📊 Jobs by source in local DB:"
docker compose exec -T postgres psql -U signal -d signalstack -c "
  SELECT 
    source,
    COUNT(*) as total,
    COUNT(DISTINCT company) as unique_companies
  FROM jobs 
  GROUP BY source 
  ORDER BY total DESC;
"

echo ""
echo "✅ Total jobs in local:"
docker compose exec -T postgres psql -U signal -d signalstack -t -A -c "SELECT COUNT(*) FROM jobs;"

echo ""
echo "📊 Companies by source in local DB:"
docker compose exec -T postgres psql -U signal -d signalstack -c "
  SELECT 
    source,
    COUNT(*) as total
  FROM companies 
  GROUP BY source 
  ORDER BY total DESC;
"

echo ""
echo "✅ Total companies in local:"
docker compose exec -T postgres psql -U signal -d signalstack -t -A -c "SELECT COUNT(*) FROM companies;"