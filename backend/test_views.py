import os, sys, django


def main():
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'fangdudu_backend.settings')
    django.setup()

    # Try to directly import each new view class
    views_to_test = [
        ('PipelineExecuteView', 'PipelineExecuteView'),
        ('PipelineSummaryView', 'PipelineSummaryView'),
        ('PipelineTaskListView', 'PipelineTaskListView'),
        ('PipelineCancelView', 'PipelineCancelView'),
        ('PipelineAuditLogView', 'PipelineAuditLogView'),
        ('WorkflowCreateView', 'WorkflowCreateView'),
        ('SecurityCheckView', 'SecurityCheckView'),
    ]

    for name, cls_name in views_to_test:
        try:
            from p2p_app.views import (
                PipelineExecuteView,
                PipelineSummaryView,
                PipelineTaskListView,
                PipelineCancelView,
                PipelineAuditLogView,
                WorkflowCreateView,
                SecurityCheckView,
            )
            cls = eval(cls_name)
            print(f'{cls_name}: OK (class={type(cls).__name__})', flush=True)
        except Exception as e:
            print(f'{cls_name}: ERROR - {e}', flush=True)

    # Also try instantiating
    print('\n--- Instantiation tests ---', flush=True)
    try:
        v = PipelineSummaryView()
        print(f'PipelineSummaryView instantiated: OK', flush=True)
    except Exception as e:
        print(f'PipelineSummaryView instantiate ERROR: {e}', flush=True)


if __name__ == '__main__':
    main()
