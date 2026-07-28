from enum import Enum
from typing import Optional, Callable
import logging

logger = logging.getLogger(__name__)


class TaskState(Enum):
    CREATED = "created"
    SHARDING = "sharding"
    DISPATCHING = "dispatching"
    EXECUTING = "executing"
    AGGREGATING = "aggregating"
    VERIFYING = "verifying"
    COMPLETED = "completed"
    FAILED = "failed"
    ABORTED = "aborted"


VALID_TRANSITIONS: dict[TaskState, list[TaskState]] = {
    TaskState.CREATED: [TaskState.SHARDING, TaskState.ABORTED],
    TaskState.SHARDING: [TaskState.DISPATCHING, TaskState.FAILED, TaskState.ABORTED],
    TaskState.DISPATCHING: [TaskState.EXECUTING, TaskState.FAILED, TaskState.ABORTED],
    TaskState.EXECUTING: [TaskState.AGGREGATING, TaskState.FAILED, TaskState.ABORTED],
    TaskState.AGGREGATING: [TaskState.VERIFYING, TaskState.FAILED],
    TaskState.VERIFYING: [TaskState.COMPLETED, TaskState.FAILED],
    TaskState.COMPLETED: [],
    TaskState.FAILED: [TaskState.DISPATCHING],
    TaskState.ABORTED: [],
}


class IllegalStateTransitionError(Exception):
    def __init__(self, current: TaskState, target: TaskState):
        self.current = current
        self.target = target
        super().__init__(f"Illegal state transition: {current.value} -> {target.value}")


class TaskStateMachine:
    def __init__(self, task_dispatch_model=None):
        self._model = task_dispatch_model
        self._state: Optional[TaskState] = None
        self._transition_hooks: dict[tuple[TaskState, TaskState], list[tuple[Callable, str]]] = {}

        if task_dispatch_model:
            self._state = TaskState(task_dispatch_model.status)

    @property
    def current_state(self) -> Optional[TaskState]:
        return self._state

    def can_transition_to(self, target: TaskState) -> bool:
        if self._state is None:
            return target == TaskState.CREATED
        allowed = VALID_TRANSITIONS.get(self._state, [])
        return target in allowed

    def transition_to(self, target: TaskState, reason: str = "", **kwargs) -> bool:
        if not self.can_transition_to(target):
            raise IllegalStateTransitionError(self._state, target)

        old_state = self._state

        self._execute_hooks(old_state, target, "before", **kwargs)

        self._state = target

        if self._model:
            self._model.status = target.value
            if target in (TaskState.COMPLETED, TaskState.FAILED, TaskState.ABORTED):
                from django.utils import timezone
                self._model.completed_at = timezone.now()
            self._model.save(update_fields=['status', 'completed_at'])

        logger.info(
            f"Task {getattr(self._model, 'task_id', '?')} state: "
            f"{old_state.value} -> {target.value} | reason={reason}"
        )

        self._execute_hooks(old_state, target, "after", **kwargs)

        return True

    def register_hook(self, from_state: TaskState, to_state: TaskState,
                      hook: Callable, when: str = "after") -> None:
        key = (from_state, to_state)
        if key not in self._transition_hooks:
            self._transition_hooks[key] = []
        self._transition_hooks[key].append((hook, when))

    def _execute_hooks(self, from_state: TaskState, to_state: TaskState,
                       when: str, **kwargs) -> None:
        key = (from_state, to_state)
        hooks = self._transition_hooks.get(key, [])
        for hook_fn, hook_when in hooks:
            if hook_when == when:
                try:
                    hook_fn(from_state, to_state, **kwargs)
                except Exception as e:
                    logger.error(f"Hook error on {from_state.value}->{to_state.value}: {e}")

    def get_valid_targets(self) -> list[TaskState]:
        if self._state is None:
            return [TaskState.CREATED]
        return VALID_TRANSITIONS.get(self._state, [])

    @staticmethod
    def get_all_transitions() -> dict[str, list[str]]:
        result: dict[str, list[str]] = {}
        for src, targets in VALID_TRANSITIONS.items():
            result[src.value] = [t.value for t in targets]
        return result

    @classmethod
    def from_task(cls, task_dispatch) -> 'TaskStateMachine':
        return cls(task_dispatch_model=task_dispatch)
