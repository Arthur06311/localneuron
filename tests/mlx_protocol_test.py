import importlib.util
import json
from pathlib import Path
import unittest
spec=importlib.util.spec_from_file_location('protocol',Path(__file__).resolve().parents[1]/'runtime/mlx_protocol.py')
protocol=importlib.util.module_from_spec(spec);spec.loader.exec_module(protocol)
class Tokenizer:
    has_thinking=True
    has_tool_calling=True
    think_start='<think>'
    think_end='</think>'
    tool_call_start='<tool_call>'
    tool_call_end='</tool_call>'
    def tool_parser(self,text,tools):return json.loads(text)
class ProtocolTests(unittest.TestCase):
    def test_fragmented_reasoning_and_tools(self):
        p=protocol.OutputParser(Tokenizer(),[{'function':{'name':'computer_info'}}]);events=[]
        text='<think>rascunho interno</think>Olá.<tool_call>{"name":"computer_info","arguments":{}}</tool_call>'
        for char in text:events+=p.feed(char)
        events+=p.feed('',final=True)
        self.assertEqual(''.join(e.get('content','') for e in events),'Olá.')
        self.assertEqual(''.join(e.get('reasoning_content','') for e in events),'rascunho interno')
        self.assertEqual(p.calls[0]['function'],{'name':'computer_info','arguments':'{}'})
    def test_unknown_and_incomplete_tools(self):
        p=protocol.OutputParser(Tokenizer(),[])
        with self.assertRaises(ValueError):p.feed('<tool_call>{"name":"terminal_run","arguments":{}}</tool_call>')
        p=protocol.OutputParser(Tokenizer(),[{'function':{'name':'files_write'}}]);p.feed('<tool_call>{"name":"files_write","arguments":',final=True)
        self.assertEqual(p.calls,[]);self.assertEqual(p.mode,'tool')
    def test_strict_model_and_generation_limits(self):
        valid={'model':'mlx:fixture','stream':True,'messages':[{'role':'user','content':'oi'}]}
        protocol.validate_request(valid,'mlx:fixture')
        for changes in [{'model':'remote/repo'},{'max_tokens':0},{'temperature':float('nan')},{'adapter':'/tmp/code'},{'chat_template_kwargs':{'trust_remote_code':True}},{'stream':False}]:
            with self.subTest(changes=changes),self.assertRaises(ValueError):protocol.validate_request({**valid,**changes},'mlx:fixture')
if __name__=='__main__':unittest.main()
