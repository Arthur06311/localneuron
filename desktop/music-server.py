"""LocalNeuron's offline, pure-DiT ACE-Step profile."""
import os
import sys


def offline_audit(event, args):
    if event == 'socket.getaddrinfo' and args[0] not in ('127.0.0.1', '::1', 'localhost', None):
        raise PermissionError('O motor musical está em modo offline.')
    if event == 'socket.connect':
        address = args[1]
        if isinstance(address, tuple) and address[0] not in ('127.0.0.1', '::1'):
            raise PermissionError('O motor musical está em modo offline.')


if __name__ == '__main__':
    sys.path.insert(0, os.getcwd())
    sys.addaudithook(offline_audit)
    # The upstream downloader checks for its optional LM even with INIT_LLM=false.
    # This fixed profile needs only DiT, VAE and the text encoder; no fake weights.
    from acestep import model_downloader
    model_downloader.MAIN_MODEL_COMPONENTS = ['acestep-v15-turbo', 'vae', 'Qwen3-Embedding-0.6B']
    from acestep.api_server import main
    main()
