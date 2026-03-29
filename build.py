import shutil
import os


def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    build_dir = os.path.join(base_dir, "build")
    extension_dir = os.path.join(base_dir, "extension")

    if os.path.exists(build_dir):
        if os.path.isdir(build_dir):
            shutil.rmtree(build_dir)
        else:
            os.remove(build_dir)

    shutil.copytree(extension_dir, build_dir)
    print("build complete - load the build folder into chrome")


if __name__ == "__main__":
    main()
