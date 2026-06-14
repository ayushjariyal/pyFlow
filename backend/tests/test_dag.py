"""Unit tests for DAG validation."""

import pytest

from app.scheduler.dag import DagValidationError, validate_dag


def test_valid_linear():
    validate_dag(["a", "b", "c"], [("a", "b"), ("b", "c")])  # no raise


def test_valid_diamond():
    validate_dag(
        ["a", "b", "c", "d"],
        [("a", "b"), ("a", "c"), ("b", "d"), ("c", "d")],
    )


def test_self_dependency_rejected():
    with pytest.raises(DagValidationError):
        validate_dag(["a"], [("a", "a")])


def test_cycle_rejected():
    with pytest.raises(DagValidationError):
        validate_dag(["a", "b"], [("a", "b"), ("b", "a")])


def test_longer_cycle_rejected():
    with pytest.raises(DagValidationError):
        validate_dag(["a", "b", "c"], [("a", "b"), ("b", "c"), ("c", "a")])


def test_unknown_ref_rejected():
    with pytest.raises(DagValidationError):
        validate_dag(["a"], [("a", "z")])


def test_duplicate_ref_rejected():
    with pytest.raises(DagValidationError):
        validate_dag(["a", "a"], [])


def test_empty_rejected():
    with pytest.raises(DagValidationError):
        validate_dag([], [])
