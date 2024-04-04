// Create global variables
var type = "immigrant"
var countries = {}
var current_country = "";
var current_factor = 'gdp';  
var current_pos = [0,0]
var reset_pos = false
var autoToggle = true
var allData = {};
var years = ['1995', '2000', '2005', '2010', '2015']; 
var year = 1995;
allData['gdp'] = {}; years.forEach(function(y) { allData['gdp'][y] = {}; });
allData['life'] = {}; years.forEach(function(y) { allData['life'][y] = {}; });
var total_migrants = {}; years.forEach(function(y) { total_migrants[y] = {}; });
var im_fraction = {}; years.forEach(function(y) { im_fraction[y] = {}; });
var im_arcs;
var em_arcs;

var search = $('#country-search')

// Config colorscales
var gdpScale = d3.scaleLinear().domain([0,90000]).range(['#dddddd','#96411B']);

var lifeScale = d3.scaleLinear().domain([30.0,100.0]).range(['#dddddd','#aa66aa']);

// Load the data
var dataRoot = "./data/processed_data/"
Promise.all([
  d3.csv(dataRoot + "GDP.csv"),
  d3.csv(dataRoot + "LifeExpectancy.csv"),
  d3.csv(dataRoot + "RawTotalMigrants.csv"),
  d3.csv(dataRoot + "NetTotalRatio.csv"),
  d3.json(dataRoot + "immigrant.json"),
  d3.json(dataRoot + "emigrant.json"),
  d3.json(dataRoot + "countries.json")
  ]).then(function(data) {
  // Process the loaded data
  var gdpData = data[0];
  var lifeData = data[1];
  var migrantsData = data[2];
  var netRatioData = data[3];
  var immigrantArcsData = data[4];
  var emigrantArcsData = data[5];
  var countriesData = data[6]

  // Call the loadAllData function with the loaded data
  loadAllData(
      null,
      gdpData,
      lifeData,
      migrantsData,
      netRatioData,
      immigrantArcsData,
      emigrantArcsData,
      countriesData
  );
  });

function loadAllData(error, gdp, life, rawtotal, imfrac, im, em, countriesData) {
    years.forEach( function(y) 
    {
        gdp.forEach( function(d) {allData['gdp'][y][d.id] = d[y]})
        life.forEach( function(d) {allData['life'][y][d.id] = d[y]})
        rawtotal.forEach( function(d) {total_migrants[y][d.id] = d[y]})
        imfrac.forEach( function(d) {im_fraction[y][d.id] = d[y]})
    });
    im_arcs = im; 
    em_arcs = em;
    countries = countriesData
    
    var searchData = ""
    Object.entries(countries).forEach((v) => {
      searchData += `
        <option value="${v[0]}">${v[1]}</option>
      `
    })
    search.append(searchData)
    search.searchBox({
        selectCallback: (e) => {
          reset_pos = true
          current_country = e.selectVal;
          drawArcs(current_country);
          loadDetailChart()
          loadDetailData()
        }
      })

    updateColors('gdp');
};

var yearDisplay = $('#range')

$("#slider").on("change", (e) => {
  year = e.target.value;
  yearDisplay.html(year)
  updateMaps();
  if(current_country) {
    loadDetailData()
    loadDetailChart()
  }
});


var autoToggleBtn = $('#auto-toggle')

autoToggleBtn.on('click', () => {
  autoToggle = !autoToggle
  if(autoToggle) {
    autoToggleBtn.html("Auto Toggle: On")
    autoToggleBtn.attr("class", "button active")
  } else {
    autoToggleBtn.html("Auto Toggle: Off")
    autoToggleBtn.attr("class", "button")
  }
})

// Adding basic elements
const body = d3.select('body');

// Adding svg
const zoom = d3.zoom().scaleExtent([1, 80]).on('zoom', zoomed).filter(() => d3.event.shiftKey && d3.event.type === "wheel" || (d3.event.type !== "wheel" ))
const height = 800;
const svg = d3
  .select('#map-container')
  .append('svg')
  .attr('width', '100%')
  .attr('height', height)
  .call(zoom)
const detail1 = d3
    .select('#detail1')
    .append('svg')
    .attr('width', '100%')
    .attr('height', 600)
var detailChartTitle = d3.select('#detail1-title');

// Detail chart settings
var canvasWidth = detail1.node().getBoundingClientRect().width;
var canvasHeight = detail1.node().getBoundingClientRect().height;
var margin = {
    top: 50,
    bottom: 50,
    left: 75,
    right: 75
};

var y = d3.scaleLinear().range([canvasHeight - margin.top, margin.bottom]);
var x = d3.scalePoint().range([margin.left, canvasWidth - margin.right]);

var xAxis = d3.axisBottom(x);
var yAxisLeft = d3.axisLeft(y).ticks(10);
var yAxisRight = d3.axisRight(y).ticks(10);

var rScale = d3.scaleLinear().domain([0.0, 2500000, 46000000]).range([5, 40, 75]);
var cScale = d3.scaleLinear().domain([-1, 0, 1]).range(['blue', '#D3D3D3', 'red']);

// Config user inputs  
var immigrant_btn = d3.select('#im-btn')
  .style("border-color", "rgba(100,100,200,0.8)")
  .on('click', ()=>{
    type = "immigrant"
    updateBtns()
    if(current_country) reset_pos = true; drawArcs(current_country);
  });
  
var emigrant_btn = d3.select('#em-btn')
  .style("border-color", "rgba(200,100,100,0.8)")
  .on('click', ()=>{
    type = "emigrant"
    updateBtns()
    if(current_country) reset_pos = true; drawArcs(current_country);
  });

const buttons = d3.select('#related-btns')

var factorBtn1 = buttons
  .append('a')
  .text('GDP per capita')
  .attr('class', 'button ' + (current_factor == "gdp" ? "active" : ""))
  .style('margin-bottom', '10px')
  .style('margin-right', '5px')
  .on('click', ()=>{
    loadFactorToMap('gdp')
    if(current_country) loadDetailChart()
  });

var factorBtn2 = buttons
  .append('a')
  .text('Life Expectancy')
  .attr('class', 'button ' + (current_factor == "life" ? "active" : ""))
  .style('margin-bottom', '10px')
  .style('margin-right', '5px')
  .on('click', ()=>{
    loadFactorToMap('life')
    if(current_country) loadDetailChart()
  });


updateBtns()

// Config for world map creation
const center = [4.5/8 * window.innerWidth, height*1.2/2]
const projection = d3
  .geoNaturalEarth1()
  .scale(300)
  .translate(center);
const pathGenerator = d3.geoPath().projection(projection);

const worldMapDiasplay = svg.append('g');
const map = worldMapDiasplay.append('g').attr('id', 'map');
const waves = worldMapDiasplay.append('g').attr('id','waves')
const circles = worldMapDiasplay.append('g').attr('id', 'circles');
const lines = worldMapDiasplay.append('g').attr('id', 'lines');

var waveList = []

for(var i = 0; i < 5; i++) {
  waveList.push(
    waves
      .append("circle")
      .attr("r", 0)
      .attr("fill", "transparent")
      .attr("cx", 0)
      .attr("cy", 0)
      .attr("class","wave")
      .style("pointer-events", "none")
  )
}

var current_wave = 0

setInterval(()=>{
  if(current_country !== "" && type !== "" && current_pos[0] != 0 && current_pos[1] != 0) {
    var startR = 0
    var endR = 0
    var startColor = "transparent"
    var endColor = "transparent"

    switch(type) {
      case "emigrant":
        startR = 0
        endR = 50
        startColor = "rgba(200,100,100,0.4)"
        endColor = "transparent"
        break
      case "immigrant":
        startR = 50
        endR = 0
        startColor = "transparent"
        endColor = "rgba(100,100,200,0.4)"
        break
    }

    var x = current_pos[0]
    var y = current_pos[1]

    waveList[current_wave]
      .attr("r", startR)
      .attr("fill", startColor)
      .attr("cx", x)
      .attr("cy", y)
      .transition(d3.easeCubic)
      .duration(3000)
      .attr("r", endR)
      .attr("fill", endColor)
  } else {
    waveList[current_wave]
      .attr("r", 0)
      .attr("cx", 0)
      .attr("cy", 0)
      .attr("fill", "transparent")
  }
  current_wave = (current_wave + 1) % waveList.length
},610)

const colorBar = d3.select("#color-range")

var colorBarGroup = colorBar
  .append('svg')
  .attr('width', colorBar.node().getBoundingClientRect().width)
  .attr('height', 60)
  .append("g")

// Config axis scale for color range
var gdpNumberScale = d3.scaleLinear().domain([0,90000])
.range([0,colorBar.node().getBoundingClientRect().width-40]);

var lifeNumberScale = d3.scaleLinear().domain([30.0,100.0])
.range([0,colorBar.node().getBoundingClientRect().width-40]);

var colorRange = colorBarGroup
  .append("linearGradient")
  .attr("id", "color-gradient")
  .attr("gradientUnits", "userSpaceOnUse")
  .attr("x1", 0)
  .attr("y1", 0)
  .attr("x2", colorBar.node().getBoundingClientRect().width-40)
  .attr("y2", 0)
  .selectAll("stop")
  .data(gdpScale.range())
  .enter().append("stop")
  .attr("offset", function(d, i) { return i / (gdpScale.range().length - 1); })
  .attr("stop-color", function(d) { return d; });

colorBarGroup.append("rect")
  .attr("x", 20)
  .attr("y", 0)
  .attr("width", colorBar.node().getBoundingClientRect().width-40)
  .attr("height", 30)
  .style("fill", "url(#color-gradient)");

var axis = d3.axisBottom(gdpNumberScale).ticks(6)

colorBarGroup.append("g")
  .attr("transform", `translate(${20},${30})`)
  .call(axis);

colorBarGroup
  .append("text")
  .text("USD")
  .attr("x", 20)
  .attr("y", 60)
  .style("fill", "white")
  .style("font-size", "10px")

// Tip for displaying brief country data
const countryTip = d3
  .tip()
  .attr('class', 'd3-tip')
  .style('display','flex')
  .style('flex-direction','column')
  .style('align-items','center')
  .html(
    (d) => {
      var factorLabel = allData[current_factor][year][d.properties.adm0_a3_us];
      var factorVal = 0.0
      var factorUnit = ""

      factorVal = allData[current_factor][year][d.properties.adm0_a3_us];

      switch(current_factor) {
        case "life":
          factorLabel = "Life Expectancy: "
          factorUnit = "Years"
          break
        case "gdp":
          factorLabel = "GDP per Capita: "
          factorUnit = "USD"
          break
      }
      return `
        <h4> 
          ${d.properties.formal_en}
        </h4>
        <br/>
        <span>
          ${factorLabel + factorVal} ${factorUnit}
        </span>
      `
  }
);

// Create world map
d3.json('./data/processed_data/world_map.json').then((data) => {
  let countries_shape = data.features;

  map
    .selectAll('path')
    .data(countries_shape)
    .enter()
    .append('path')
    .attr('class', 'map')
    .attr('d', pathGenerator)
    .style('fill', '#fff')
    .style('filter', 'brightness(1)')
    .style('stroke', 'rgb(150, 150, 150)')
    .style('stroke-opacity', '1')
    .style('transition', 'all 0.2s ease-in-out')
    .call(countryTip)
    .on('mouseover', function (d) {
      d3.select(this).style('filter', 'brightness(1.2)')
      countryTip.show(d,this)
    })
    .on('mouseout', function(d) {
      d3.select(this).style('filter', 'brightness(1)')
      countryTip.hide(d,this)
    })
    .on('click', (d) => {
      reset_pos = true
      current_country = d3.select(d3.event.target).data()[0].properties.adm0_a3_us;
      drawArcs(current_country);
      loadDetailChart()
      loadDetailData()
      search.val(current_country)
    });

    if(allData['gdp']) updateColors('gdp');
});





// ========================================================= Functions =========================================================
var detailHeader = d3.select('#detail-migration-title')
var detailImBody = d3.select('#detail-im')
var detailEmBody = d3.select('#detail-em')

// Load data to the migration data detail on the left hand side
function loadDetailData() {
  var detailImData = im_arcs[year][current_country]
  var detailEmData = em_arcs[year][current_country]

  var totalIm = 0
  var totalEm = 0
  
  var detailImDisplay = ""
  var detailEmDisplay = ""

  detailHeader.html(`Migration data of <span style="font-weight: 600">${countries[current_country]}</span>`)

  detailImData.forEach(d => {
    totalIm += d.value
    detailImDisplay += 
      `<span >
        From ${d.name}: ${d.value}
      </span><br/>`
  })

  detailImBody.html(`
    <h4>Total Immigration: ${totalIm}</h4>
    <br/>
    ${detailImDisplay}
  `)

  detailEmData.forEach(d => {
    totalEm += d.value
    detailEmDisplay += 
      `<span ">
        To ${d.name}: ${d.value}
      </span><br/>`
  })

  detailEmBody.html(`
    <h4>Total Emigration: ${totalEm}</h4>
    <br/>
    ${detailEmDisplay}
  `)
}

// Draw curved migration acrs on the map
function drawArcs(country) {

  // Remove all old arcs
  clearArcs()

  var arcs = []
  var color = "white"
  if(type == "immigrant") {
    arcs = im_arcs[year][country]  
    if(reset_pos) {
      reset_pos = false
      current_pos = projection([arcs[0].destination.longitude, arcs[0].destination.latitude])
    }
    color = '130,130,255'
  } else if(type == "emigrant") {
    arcs = em_arcs[year][country]
    if(reset_pos) {
      reset_pos = false
      current_pos = projection([arcs[0].origin.longitude, arcs[0].origin.latitude])
    }
    color = '255,130,130'
  }

  if(autoToggle) svg.transition().duration(1500).call(zoom.transform, d3.zoomIdentity.translate(center[0] - current_pos[0],center[1] - current_pos[1]));

  // Set time out to wait for clearArcs to finish its animation
  setTimeout(()=> {

    lines.selectAll('.line').remove();

    let displayLines = lines
      .selectAll('.line')
      .data(arcs)
      .enter()
      .append('path')
      .attr('class', 'line')
      .attr('id', (d, i) => `line${i}`)
      .attr('d', (d) => {
        return drawArc(
          d3.path(),
          projection([d.origin.longitude, d.origin.latitude]),
          projection([d.destination.longitude, d.destination.latitude]),
        )
      })
      .style('stroke', `rgba(${color},0.5)`)
      .style('fill', `transparent`)
      .style('pointer-events', `none`)
      .style('opacity', '0');

    // Animating the paths
    displayLines.each((d, i) => {
      let totalLength = d3
        .select('#line' + i)
        .node()
        .getTotalLength();
      if (totalLength > 0) {
        d3.selectAll('#line' + i)
          .attr('stroke-dasharray', totalLength + ' ' + totalLength)
          .attr('stroke-dashoffset', totalLength)
          .style('opacity', '1')
          .transition(d3.easeCubic)
          .duration(500)
          .delay(500 + 5 * i)
          .attr('stroke-dashoffset', 0)
          .style('stroke-width', 5);
      }
    });

    

    // Remove old circles
    circles.selectAll('.circle').remove();

    circles
      .selectAll('.circle')
      .data(arcs)
      .enter()
      .append('circle')
      .attr('class', 'circle')
      .attr('cx', (d) => {
        if(type == "immigrant") {
          return projection([d.origin.longitude, d.origin.latitude])[0]
        } else if(type == "emigrant") {
          return projection([d.destination.longitude, d.destination.latitude])[0]
        } else {
          return null
        }
      })
      .attr('cy', (d) => {
        if(type == "immigrant") {
          return projection([d.origin.longitude, d.origin.latitude])[1]
        } else if(type == "emigrant") {
          return projection([d.destination.longitude, d.destination.latitude])[1]
        } else {
          return null
        }
      })
      .attr('fill', `rgba(${color},0.5)`)
      .attr('stroke', `rgba(${color},1)`)
      .attr('stroke-width', '1px')
      .style('pointer-events', `none`)
      .attr('r', 0)
      .transition()
      .duration(1000)
      .delay((d, i) => {
        if(type == "immigrant") {
          return 5 * i
        } else if(type == "emigrant") {
          return 500 + 5 * i
        } else {
          return 0
        }
      })
      .attr('r', (d) => {
        return d.scaledValue*15
      });
  }, 200)
}

// Draw a single arc between the origin and destination
function drawArc(path, origin, end) {
  path.moveTo(origin[0], origin[1]);
  path.quadraticCurveTo((origin[0] + end[0])/2, (origin[1] + end[1])/2 - (Math.abs(end[0]-origin[0]) + Math.abs(end[1]-origin[1]))/3, end[0], end[1] - 1);
  return path;
}

function zoomed() {
  worldMapDiasplay.attr('transform', d3.event.transform);
}

function reset() {
  svg.transition().duration(1500).call(zoom.transform, d3.zoomIdentity);
  clearArcs();
}

function clearArcs() {
  current_pos = [0,0]
  lines.selectAll('.line').each((d, i) => {
    let totalLength = d3
      .select('#line' + i)
      .node()
      .getTotalLength();
    d3.selectAll('#line' + i)
      .transition()
      .duration(200)
      .attr('stroke-dashoffset', totalLength)
      .remove();
  });
  circles
    .selectAll('.circle')
    .transition()
    .duration(200)
    .attr('r', 0)
    .remove();
  d3.select('#immigration-circle').transition().duration(1000).remove();
}


// Tip for displaying detail chart information
const detailTip = d3
  .tip()
  .attr('class', 'd3-tip')
  .style('display','flex')
  .style('flex-direction','column')
  .style('align-items','center')
  .html(
    () => {
      return `
        <h4>${countries[current_country]}</h4>
        <span>
          Total migrants: ${total_migrants[year][current_country]}
          <br/>
          Immigrant/Emigrant ratio: ${im_fraction[year][current_country]}
        </span>
      `
  }
);

// Load the aiding chart under world map
function loadDetailChart() {
     
  detail1.html(null);
 
  detail1
  .append("svg")
  .attr("width", "100%")
  .attr("height", canvasHeight);
                        
  detailChartTitle.innerHTML = "Showing data for country: " + current_country + ", for factor: " + current_factor;

  x.domain(["Immigrants", "Selected Country", "Emigrants"])
  var datamin, datamax;

  var plotfactor = ""
  if (current_factor == 'life'){
      plotfactor = 'life'; 
      datamin = 50; datamax = 70;
      detailChartTitle.html(countries[current_country]+"'s " + year + " migration in Life Expectancy context.")
  } else {
      plotfactor = 'gdp'; 
      datamin = 1000; datamax = 5000;
      detailChartTitle.html(countries[current_country]+"'s " + year + " migration in GDP per capita context.")
  }

  var plotdata = allData[plotfactor][year];
  var circle_y = plotdata[current_country];

  var im_lines = [];
  var em_lines = [];

  im_arcs[year][current_country].forEach(function (arc) {
      im_lines.push({
        'endpts': [
          {x: "Immigrants", y: plotdata[arc.id]},
          {x: "Selected Country", y: circle_y}
        ],
        'stroke-width': arc['scaledValue']
      });
      if (Number(plotdata[arc.id]) < datamin) datamin = Number(plotdata[arc.id]);
      if (Number(plotdata[arc.id]) > datamax) datamax = Number(plotdata[arc.id]);
  });
  em_arcs[year][current_country].forEach(function (arc) {
      em_lines.push({
        'endpts': [
          {x: "Selected Country", y: circle_y},
          {x: "Emigrants", y: plotdata[arc.id]}
        ],
        'stroke-width': arc['scaledValue']
      })
      if (Number(plotdata[arc.id]) < datamin) datamin = Number(plotdata[arc.id]);
      if (Number(plotdata[arc.id]) > datamax) datamax = Number(plotdata[arc.id]);
  });
  y.domain([datamin, datamax]);

  // append axes
  detail1.append("g")
      .attr("class", "x axis")
      .attr("transform", "translate(0,"+ (canvasHeight-margin.bottom) + ")")
      .attr("id","the_X_ax")
      .style("stroke", "white")
      .style("color", "white")
      .call(xAxis);
  detail1.append("g")
      .attr("class", "y axis")
      .attr("transform", "translate("+margin.left+",0)")
      .attr("id","the_Y_ax")
      .style("stroke", "white")
      .style("color", "white")
      .call(yAxisLeft);
  detail1.append("g")
      .attr("class", "y axis")
      .attr("transform", "translate(" + (canvasWidth-margin.right) + ",0)")
      .attr("id","the_Y_ax_2")
      .style("stroke", "white")
      .style("color", "white")
      .call(yAxisRight);

  // draw lines
  var lineFunction = d3.line()
      .x(d => x(d.x))
      .y(d => y(d.y));

  detail1.selectAll()
      .data(im_lines)
      .enter().append("path")
      .attr("d", function(d) {return lineFunction(d['endpts']); })
      .attr("stroke-width", function(d) {return d['stroke-width'] * 2;})
      .attr("id","the_IM_lines")
      .attr("stroke","rgb(150,150,255)") ;

  detail1.selectAll()
      .data(em_lines)
      .enter().append("path")
      .attr("d", function(d) {return lineFunction(d['endpts']); })
      .attr("stroke-width", function(d) {return d['stroke-width'] * 2;})
      .attr("id","the_EM_lines")
      .attr("stroke","rgb(255,150,150)");

  var r = rScale(total_migrants[year][current_country])

  // Current country circle
  detail1.append("circle")
      .attr("r", r)
      .attr("fill", cScale(im_fraction[year][current_country]))
      .attr("cx", x("Selected Country"))
      .attr("cy", y(circle_y))
      .attr("id","country-circle")
      .call(detailTip)
      .on('mouseover', function () {
        detailTip.show(this)
      })
      .on('mouseout', function() {
        detailTip.hide(this)
      });

  // Current country name
  detail1.append("text")
      .text(countries[current_country])
      .attr("x", x("Selected Country"))
      .attr("fill", "white")
      .attr("y", y(circle_y) - r - 10 > 0 ? y(circle_y) - r - 10 : y(circle_y) + r + 10)
      .attr("id","country-name")
      .attr("text-anchor","middle");
}


// Update functions to respond to user's action


function updateMaps() {
  if(current_country) {
    reset_pos = true
    drawArcs(current_country);
  }

  updateColors(current_factor);
}

function updateBtns() {
  immigrant_btn
    .style("background-color", type == "immigrant" ? "rgba(100,100,200,0.8)" : "rgba(0,0,0,0.3)")
    .style("color", type == "immigrant" ? "white" : "rgba(100,100,200,0.8)")
  
  emigrant_btn
    .style("background-color", type == "emigrant" ? "rgba(200,100,100,0.8)" : "rgba(0,0,0,0.3)")
    .style("color", type == "emigrant" ? "white" : "rgba(200,100,100,0.8)")
}

function loadFactorToMap(factorValue) {
  current_factor = factorValue;
  factorBtn1.attr('class', 'button ' + (current_factor == "gdp" ? "active" : ""))
  factorBtn2.attr('class', 'button ' + (current_factor == "life" ? "active" : ""))
  updateColors(current_factor);
  updateColorRange()
}

function updateColors(factorValue) {
    map.selectAll("path")
      .style("fill", (d) => {
        var scale = () => {
          return "#dddddd"
        }
        switch(factorValue) {
          case "gdp":
            scale = gdpScale
            break;
          case "life":
            scale = lifeScale
        }
        var color = scale(allData[factorValue][year][d.properties.adm0_a3_us])
        return color ? color : "#dddddd";
      });
  }

  function updateColorRange() {
    var color = null
    var axisLabel = null
    var unit = "N/A"
    colorBar.html(null)
    switch(current_factor) {
      case "gdp":
        color = gdpScale
        axisLabel = gdpNumberScale
        unit = "USD"
        break
      case "life":
        color = lifeScale
        axisLabel = lifeNumberScale
        unit = "Years"
        break
    }

    colorBarGroup = colorBar
      .append('svg')
      .attr('width', colorBar.node().getBoundingClientRect().width)
      .attr('height', 60)
      .append("g")
     
    colorRange = colorBarGroup
      .append("linearGradient")
      .attr("id", "color-gradient")
      .attr("gradientUnits", "userSpaceOnUse")
      .attr("x1", 20)
      .attr("y1", 0)
      .attr("x2", colorBar.node().getBoundingClientRect().width-40)
      .attr("y2", 0)
      .selectAll("stop")
      .data(color.range())
      .enter().append("stop")
      .attr("offset", function(d, i) { return i / (color.range().length - 1); })
      .attr("stop-color", function(d) { return d; });


    colorBarGroup.append("rect")
      .attr("x", 20)
      .attr("y", 0)
      .attr("width", colorBar.node().getBoundingClientRect().width-40)
      .attr("height", 30)
      .style("fill", "url(#color-gradient)");

    axis = d3.axisBottom(axisLabel).ticks(6)

    colorBarGroup.append("g")
      .attr("transform", `translate(${20},${30})`)
      .call(axis);

    colorBarGroup
      .append("text")
      .text(unit)
      .attr("x", 20)
      .attr("y", 60)
      .style("fill", "white")
      .style("font-size", "10px")
  }