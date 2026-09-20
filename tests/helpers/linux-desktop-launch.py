import ctypes,sys
lib=ctypes.CDLL('libgio-2.0.so.0')
lib.g_desktop_app_info_new_from_filename.argtypes=[ctypes.c_char_p]
lib.g_desktop_app_info_new_from_filename.restype=ctypes.c_void_p
lib.g_app_info_launch.argtypes=[ctypes.c_void_p,ctypes.c_void_p,ctypes.c_void_p,ctypes.POINTER(ctypes.c_void_p)]
lib.g_app_info_launch.restype=ctypes.c_int
info=lib.g_desktop_app_info_new_from_filename(sys.argv[1].encode())
assert info, 'Desktop file failed to load'
error=ctypes.c_void_p()
assert lib.g_app_info_launch(info,None,None,ctypes.byref(error)), 'Desktop launch failed'
