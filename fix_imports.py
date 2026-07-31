import os

# Fix all email template imports
templates_dir = r'D:\Projects\SafariZetu Automation\safarizetu-ops-engine\src\services\email-templates'

for filename in os.listdir(templates_dir):
    if filename.endswith('.ts'):
        filepath = os.path.join(templates_dir, filename)
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        if "from '../email-template-helpers'" in content:
            content = content.replace("from '../email-template-helpers'", "from '../email-templates'")
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f'Fixed: {filename}')
        else:
            print(f'OK: {filename}')
