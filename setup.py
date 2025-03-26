from setuptools import setup, find_packages

setup(
    name='quicklearnfeed',
    version='1.0.0',
    packages=find_packages(),
    include_package_data=True,
    install_requires=[
        'Flask',
        'google-generativeai',
        'feedparser',
        'requests',
        'beautifulsoup4',
        'python-dotenv',
    ],

    entry_points="""
        [console_scripts]
        quicklearnfeed = quicklearnfeed:main
    """,
)
