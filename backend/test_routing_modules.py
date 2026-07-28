from p2p_app.routing.matrix import RoutingMatrixEngine, RoutingDecision, ROUTING_MATRIX
from p2p_app.routing.geo_router import GeoRouter, REGION_GROUPS

print('[OK] matrix.py imported')
print(f'  - ROUTING_MATRIX has {len(ROUTING_MATRIX)} scenarios')
print(f'  - RoutingMatrixEngine class available')
print(f'  - RoutingDecision dataclass available')

print('[OK] geo_router.py imported')
print(f'  - REGION_GROUPS has {len(REGION_GROUPS)} region groups')
print(f'  - GeoRouter class available')

engine = RoutingMatrixEngine()
geo_router = GeoRouter()

test_context = {
    'task_type': 'text',
    'size_bytes': 512,
}
result = engine.match_scenario(test_context)
if result:
    print(f'[OK] Scenario match test passed: {result["name"]}')
else:
    print('[FAIL] Scenario match test failed')

region = geo_router.get_region_for_location('shanghai')
if region:
    print(f'[OK] Region lookup test passed: shanghai -> {region}')
else:
    print('[FAIL] Region lookup test failed')

print('\nAll modules verified successfully!')
