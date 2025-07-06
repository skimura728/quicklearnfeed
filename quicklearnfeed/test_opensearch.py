from opensearchpy import OpenSearch
from pprint import pprint

# Initialize OpenSearch client
client = OpenSearch(
    hosts=[{"host": "localhost", "port": 9200}],
    http_auth=("admin", os.environ["OPENSEARCH_PASSWORD"]),
    use_ssl=False,
    verify_certs=False
)

def fetch_latest_documents(index_name="qlf_articles", size=5):
    result = client.search(
        index=index_name,
        body={
            "size": size,
            "sort": [{"timestamp": "desc"}],
            "query": {"match_all": {}}
        }
    )
    return result["hits"]["hits"]

# Retrieve documents and display their _source field
if __name__ == "__main__":
    docs = fetch_latest_documents()
    print(f"✅ Found {len(docs)} documents in OpenSearch:")
    for doc in docs:
        pprint(doc["_source"])
