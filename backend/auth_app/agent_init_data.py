import os
import sys
import json
import django

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'fangdudu_backend.settings')
django.setup()

from auth_app.agent_models import AgentConfig


def load_texts():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    json_path = os.path.join(base_dir, 'agent_init_texts.json')
    if os.path.exists(json_path):
        with open(json_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    return None


def create_agent_configs(texts):
    agents_data = texts.get('agents', {})
    created_count = 0

    for code, agent_text in agents_data.items():
        config, created = AgentConfig.objects.get_or_create(
            code=code,
            defaults={
                'name': agent_text.get('name', code),
                'enabled': True,
                'sort_order': agent_text.get('sort_order', 0),
                'short_desc': agent_text.get('short_desc', ''),
                'full_desc': agent_text.get('full_desc', ''),
                'icon': agent_text.get('icon', 'RobotOutlined'),
                'color': agent_text.get('color', '#2563EB'),
                'bg_color': agent_text.get('bg_color', '#EFF6FF'),
                'system_prompt': agent_text.get('system_prompt', ''),
                'welcome_msg': agent_text.get('welcome_msg', ''),
                'temperature': agent_text.get('temperature', 0.7),
                'max_tokens': agent_text.get('max_tokens', 2000),
                'allow_summary': True,
                'allow_analysis': True,
                'allow_query': True,
                'allow_export': False,
                'timeout': 30,
                'retry_count': 2,
                'model': 'gpt-4o',
            }
        )

        if not created:
            config.name = agent_text.get('name', config.name)
            config.short_desc = agent_text.get('short_desc', config.short_desc)
            config.full_desc = agent_text.get('full_desc', config.full_desc)
            config.icon = agent_text.get('icon', config.icon)
            config.color = agent_text.get('color', config.color)
            config.bg_color = agent_text.get('bg_color', config.bg_color)
            config.system_prompt = agent_text.get('system_prompt', config.system_prompt)
            config.welcome_msg = agent_text.get('welcome_msg', config.welcome_msg)
            config.temperature = agent_text.get('temperature', config.temperature)
            config.max_tokens = agent_text.get('max_tokens', config.max_tokens)
            config.sort_order = agent_text.get('sort_order', config.sort_order)
            config.save()

        status = 'created' if created else 'updated'
        print(f"  [{status}] {config.name} ({code})")
        created_count += 1

    return created_count


def main():
    print("=" * 50)
    print("Agent Configuration Initialization Script")
    print("=" * 50)

    texts = load_texts()
    if not texts:
        print("\nError: agent_init_texts.json file not found!")
        print("Please create the JSON file first with the required data structure.")
        return

    print("\n[1/1] Creating/Updating Agent Configurations...")
    count = create_agent_configs(texts)

    print("\n" + "=" * 50)
    print(f"Agent Initialization Complete! Total: {count} agents")
    print("=" * 50)


if __name__ == '__main__':
    main()
