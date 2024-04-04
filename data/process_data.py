import pandas as pd
import json

labels = ['Country Name', 'Country Code']
years = ['1995', '2000', '2005', '2010', '2015']
used = labels + years
not_used = ['Destination', 'Numeric', 'Data Type', 'Total', 'Other North', 'Other South']

# Read the manually processed data
countries  = pd.read_csv('../raw_data/CountriesList.txt', delimiter=' , ', index_col='Country Code', engine='python')
latlong = pd.read_csv('../raw_data/LatLong.csv', index_col='Alpha-3', engine='python', usecols=['Alpha-3', 'lat', 'long'])
iso_codes = pd.read_csv('../raw_data/ISO_codes.csv', index_col='country-code')
pop = pd.read_csv('../raw_data/Population.csv', index_col='Country Code', usecols=used)
lifeExp = pd.read_csv('../raw_data/WB_LifeExpect.csv', index_col='Country Code', usecols=used)
gdp = pd.read_csv('../raw_data/GDP.csv', index_col='Country Code', usecols=used)
migrate_data = pd.read_excel('../raw_data/migrate_1995.xlsx', header=0)

countries_dict = countries.to_dict()
countries_list = countries.index.tolist()
latlong_list = latlong.index.tolist()

shared_index = countries.loc[list(set(countries_list) & set(latlong_list))].index
shared_index = pop.index.intersection(shared_index)

pop = pop.reindex(shared_index)

immigrants = {}
emigrants = {}
maxs = {}

im_lines = {}
em_lines = {}

positive_stock = pd.DataFrame(0.0, index=pop.index, columns=years)
negative_stock = pd.DataFrame(0.0, index=pop.index, columns=years)
net_stock = pd.DataFrame(0.0, index=pop.index, columns=years)
total_stock = pd.DataFrame(0.0, index=pop.index, columns=years)
im_frac = pd.DataFrame(0.0, index=pop.index, columns=years)


def scale(value, max_val):
    return ((value * (10 - 0.2)) / max_val) + 0.2

def cal_migration(year):
    migration = pd.read_excel('../raw_data/Migrate_' + year + '.xlsx', header=0)

    migration = migration.query('Numeric < 900 and Numeric != 830')
    migration['Country Code'] = iso_codes.loc[migration['Numeric'], 'alpha-3'].values
    migration.set_index('Country Code', inplace=True)
    migration_shared_index = migration.index.intersection(pop[year].dropna().index)
    migration = migration.reindex(migration_shared_index)
    pop[year] = pop[year].reindex(migration_shared_index)

    good_countries = set(migration['Destination'])

    for ccol in migration.columns[6:]:
        if ccol not in good_countries:
            migration.drop(ccol, axis=1, inplace=True)
        else:
            migration.rename(columns={ccol: migration.index[migration['Destination'] == ccol][0]}, inplace=True)

    new_not_used = []
    for not_used_col in not_used:
        if not_used_col in migration:
            new_not_used.append(not_used_col)

    return migration.drop(new_not_used, axis=1)

def mig_line(origin, destination, status, value, scaledValue):
    d = dict()
    d['origin'] = {'latitude': latlong.loc[origin]['lat'],
                   'longitude': latlong.loc[origin]['long']}
    d['destination'] = {'latitude': latlong.loc[destination]['lat'],
                        'longitude': latlong.loc[destination]['long']}
    d['value'] = value
    d['scaledValue'] = scaledValue
    if status == 'im':
        d['id'] = origin
        d['name'] = countries_dict['Country Name'][origin]
    elif status == 'em':
        d['id'] = destination
        d['name'] = countries_dict['Country Name'][destination]
    return d


def mig_row(row_name, row, status, max_val):
    if status == 'im':
        # for immigration, row_name = destination
        l = [mig_line(origin, row_name, status, value, scale(value,max_val)) for origin, value in row.items()]
    elif status == 'em':
        # for emigration, row_name = origin
        l = [mig_line(row_name, destination, status, value,  scale(value,max_val)) for destination, value in row.items()]
    return l


# threshold: we only count arcs where (num_people > threshold)
def mig_lines(migration, status, threshold, maximum):
    assert status in ['im', 'em']
    # second parameter of Scaler sets the range for strokeWidth
    d = {}
    if status == 'im':
        for code, row in migration.iterrows():
            d[code] = mig_row(code, row[row > threshold], 'im', maximum)
    elif status == 'em':
        for code, row in migration.iterrows():
            d[code] = mig_row(code, row[row > threshold], 'em', maximum)

    return d


for year in years:
    immigrants[year] = cal_migration(year)
    maxs[year] = immigrants[year].max().max()
    emigrants[year] = immigrants[year].transpose()
    im_lines[year] = mig_lines(immigrants[year], 'im', 1000, maxs[year])
    em_lines[year] = mig_lines(emigrants[year], 'em', 1000, maxs[year])


for year in years:
    positive_stock[year] = immigrants[year].fillna(0.0).sum(axis=0)
    negative_stock[year] = emigrants[year].fillna(0.0).sum(axis=0)

    total_stock[year] = positive_stock[year] + negative_stock[year]
    net_stock[year] = positive_stock[year] - negative_stock[year]

    im_frac[year] = net_stock[year] / total_stock[year]

lifeExp = lifeExp.reindex(lifeExp.index.intersection(shared_index))
lifeExp.drop('SRB', inplace=True)

pop = pop.reindex(pop.index.intersection(countries.index))
gdp = gdp.reindex(pop.index.intersection(pop.index))

gdp_per_cap = gdp.copy()
for year in years:
    gdp_per_cap[year] = gdp[year] / pop[year]

gdp_per_cap.rename(columns={'Country Name': 'name'}, inplace=True)

with open('../processed_data/immigrant.json', 'w') as out: json.dump(im_lines, out, indent=2)
with open('../processed_data/emigrant.json', 'w') as out: json.dump(em_lines, out, indent=2)
with open('../processed_data/countries.json', 'w') as out: json.dump(countries_dict['Country Name'], out, indent=2)
gdp_per_cap.fillna(0).to_csv('../processed_data/GDP.csv', index_label='id')
lifeExp.to_csv('../processed_data/LifeExpectancy.csv', index_label='id')
total_stock.to_csv('../processed_data/RawTotalMigrants.csv', index_label='id')
im_frac.to_csv('../processed_data/NetTotalRatio.csv', index_label='id')