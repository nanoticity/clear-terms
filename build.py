import shutil, os

if os.path.exists("build"):
    shutil.rmtree("build")

shutil.copytree("extension", "build")
print("build complete - load the build folder into chrome")
