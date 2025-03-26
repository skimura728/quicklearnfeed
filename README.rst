==========================
Quick English Learning App
==========================

Purpose
=======

This app is designed to help people who often give up reading English news articles because they are too long and detailed.
By providing summaries, the app allows users to quickly grasp the main points and easily look up unfamiliar words.


Tools Version
=============
:Python: 3.10.12
:pip:    22.0.2

Installation and Startup Instructions
=====================================

Clone the code from the repository and set up a venv environment underneath it.::

  $ git clone https://github.com/skimura728/quicklearnfeed.git
  $ cd quicklearnfeed
  $ python3 -m venv venv
  $ source venv/bin/activate
  (venv) $ pip install .

API Key Setup
=============

Before running the app, create a `.env` file in the project root directory and add your API key. The file should look like this::

  GOOGLE_API_KEY=your-api-key-here

You can get your API key from the Google Cloud Console.  
Without setting this key, the app will not be able to generate summaries.


Run the Application
====================

After installing, run the app with the following command::

  (venv) $ quicklearnfeed
   * Running on http://127.0.0.1:8000/


Development Steps
=================

1. Checkout the repository
2. Install using the following steps::

   (venv) $ pip install -e .
