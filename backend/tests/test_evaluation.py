import importlib.util
from pathlib import Path
import argparse
import json
import tempfile
import unittest
from unittest.mock import Mock, patch

from app.cli.evaluate import (CallBudget, Question, Evidence, evaluate_question, reference_match,
                              reviewed, summary, run)
from app.core.config import Settings
from app.core.errors import ServiceError


class EvaluationTests(unittest.TestCase):
    def question(self, **updates):
        data = dict(question_id='P1', question='Một câu hỏi?', category='academic', applicable_year=None,
                    kind='answerable', expected_status='answered', key_points=['draft'],
                    evidence=[dict(document_id='doc', section_contains='Mục', support_excerpt='Nội dung', confirmed=False)],
                    review_status='draft', reviewers=[])
        return Question(**{**data, **updates})

    def test_retrieval_only_never_calls_generator_and_draft_is_not_confirmed_metric(self):
        retriever = Mock(version='index', search=Mock(return_value=[{
            'document_id': 'doc', 'page_or_section': 'Mục 1', 'text': 'Nội dung nguồn', 'chunk_id': 'chunk'}]))
        adapter = Mock()
        row = evaluate_question(self.question(), retriever, Settings(_env_file=None), 'retrieval', adapter,
                                CallBudget(0), 30, float('inf'))
        adapter.generate.assert_not_called()
        self.assertTrue(row['reference_checks'][0]['hit'])
        self.assertFalse(row['reference_checks'][0]['confirmed'])
        metrics = summary([row])
        self.assertIsNone(metrics['content_accuracy'])
        self.assertIsNone(metrics['confirmed_retrieval_hit_rate'])
        self.assertIsNone(metrics['answered_valid_citation_rate'])

    def test_two_reviewers_and_confirmation_required_for_hit_metric(self):
        question = self.question(review_status='human_approved', reviewers=['Thu Trang', 'Reviewer 2'])
        self.assertTrue(reviewed(question))
        self.assertFalse(reviewed(self.question(review_status='human_approved', reviewers=['Thu Trang'])))
        self.assertFalse(reviewed(self.question(review_status='human_approved', reviewers=['A', 'B'])))
        self.assertFalse(reviewed(self.question(review_status='human_approved', reviewers=['Thu Trang', ' thu trang '])))
        self.assertFalse(reference_match(Evidence(document_id='other'), [{'document_id':'doc'}]))
        self.assertTrue(reference_match(Evidence(document_id='doc',chunk_ids=['c']),
                                       [{'document_id':'doc','chunk_id':'c'}]))

    def test_budget_and_deadline_do_not_invoke_generator(self):
        budget = CallBudget(1)
        budget.take()
        with self.assertRaises(ServiceError):
            budget.take()
        self.assertEqual(budget.calls, 1)
        adapter = Mock()
        row = evaluate_question(self.question(), Mock(version='index'), Settings(_env_file=None),
                                'e2e', adapter, CallBudget(2), 30, 0)
        self.assertEqual(row['error_code'], 'evaluation_run_deadline')
        adapter.generate.assert_not_called()

    def test_paid_mode_needs_opt_in_before_loading_models_or_sdk(self):
        with tempfile.TemporaryDirectory() as directory:
            dataset = Path(directory) / 'dataset.json'
            dataset.write_text(json.dumps(dict(schema_version=1,dataset_id='test',purpose='test',
                review_status='draft',questions=[self.question().model_dump()])),encoding='utf-8')
            args = argparse.Namespace(dataset=dataset,index_dir=Path(directory),mode='e2e',
                                      provider='bedrock',allow_paid_calls=False,timeout=30)
            with patch('app.cli.evaluate.Retriever') as retriever:
                with self.assertRaisesRegex(ValueError,'allow-paid-calls'):
                    run(args)
                retriever.assert_not_called()


class ConversionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        path = Path(__file__).resolve().parents[2] / 'evaluation' / 'prepare_vku_pilot.py'
        spec = importlib.util.spec_from_file_location('pilot_prepare_test', path)
        cls.module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(cls.module)

    def test_main_article_excludes_navigation_and_preserves_vietnamese(self):
        html = '<html><nav>MENU</nav><h2>Tiêu đề thật</h2><div class="content-detail"><p>Nội dung tiếng Việt có dấu. ' + 'Nguồn công khai. '*20 + '</p></div><footer>FOOTER</footer></html>'
        title, markdown, fragment = self.module.convert(html, 'admissions')
        self.assertEqual(title, 'Tiêu đề thật')
        self.assertIn('tiếng Việt có dấu', markdown)
        self.assertNotIn('MENU', markdown)
        self.assertNotIn('FOOTER', fragment)

    def test_table_rowspan_and_colspan_are_expanded(self):
        tree = self.module.Tree('<table><tr><th>A</th><th>B</th></tr><tr><td rowspan="2">Khóa 2022</td><td>CNTT</td></tr><tr><td>QTKD</td></tr><tr><td colspan="2">Tất cả</td></tr></table>')
        table = next(n for n in tree.root.nodes() if n.tag == 'table')
        rows = self.module.table_rows(table)
        self.assertEqual(rows[2], ['Khóa 2022', 'QTKD'])
        self.assertEqual(rows[3], ['Tất cả', 'Tất cả'])


if __name__ == '__main__':
    unittest.main()
