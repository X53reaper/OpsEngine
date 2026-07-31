SELECT 'operators' as tbl, COUNT(*) as cnt FROM operators
UNION ALL SELECT 'lodges', COUNT(*) FROM lodges
UNION ALL SELECT 'listings', COUNT(*) FROM listings
UNION ALL SELECT 'experiences', COUNT(*) FROM experiences
UNION ALL SELECT 'destinations', COUNT(*) FROM destinations
UNION ALL SELECT 'jobs', COUNT(*) FROM jobs
UNION ALL SELECT 'enquiry_log', COUNT(*) FROM enquiry_log;
