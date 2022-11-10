import * as d3 from "d3";
import { rgb, select } from "d3";
import * as topojson from "topojson";

//Import Data
var world = await d3.json(
  "https://gist.githubusercontent.com/olemi/d4fb825df71c2939405e0017e360cd73/raw/d6f9f0e9e8bd33183454250bd8b808953869edd2/world-110m2.json"
);

var animals_data = await d3.csv("Final_Data.csv");

// 250 countries in the data set of animals-data at first
var countryCodes = await d3.tsv("https://d3js.org/world-110m.v1.tsv");

let TotalofCurrentGroup = 0;

//Select only countries that have countryCode.
var filterd_animals = animals_data.filter((item) => {
  return item["CountryCode"] !== "" || item["CountryCode"] !== undefined;
});
// why is it showing 255 ??

//changing the country code to a number.
var animalCountry_toNum = new Map();
filterd_animals.map((item) =>
  countryCodes.map((item2) => {
    let i = 0;
    // the letters of ISO for each country , ISO-n3
    if (item["CountryCode"] === item2["iso_a3"]) {
      animalCountry_toNum.set(item["CountryCode"], item2["iso_n3"]);
    }
  })
);

//Build the data structure needed.
var adjusted_animals = filterd_animals.map((item) => {
  if (animalCountry_toNum.get(item["CountryCode"]) === undefined) {
    return null;
    // we are getting the countries that have undefined  for "CountryCode" and instead make them Null
  } else {
    let newDatum = Object.assign({}, item);
    // Assign item or filterd animals to the new Datum
    if (animalCountry_toNum.get(item["CountryCode"]) !== undefined) {
      newDatum["CountryCode"] = animalCountry_toNum.get(item["CountryCode"]);
    }
    return newDatum;
  }
});

//remove any null objects.
var adjusted_animals = adjusted_animals.filter(function (el) {
  return el != null;
});

//final form of the data.
var data_animal = new Map();
adjusted_animals.forEach((item) => {
  if (item !== null) {
    data_animal.set(+item["CountryCode"], item);
  }
});
// console.log(data_animal);
// so at the end there are 169 countries in our data set that matches the data in the country code object ?

//minimum and maximum endangered species for color coding.
let animal_minVal = 100000000000;
let animal_maxVal = 0;

data_animal.forEach((value) => {
  if (value["Total"] !== undefined) {
    animal_minVal = Math.min(
      animal_minVal,
      Number(String(value["Total"]).replace(",", ""))
    );
    animal_maxVal = Math.max(
      animal_maxVal,
      Number(String(value["Total"]).replace(",", ""))
      // i forgot why are we making them STRING AT FIRST
    );
  }
});
let paletteScale = d3
  .scaleLinear()
  .domain([animal_minVal, animal_maxVal])
  .range(["#EFEFFF", "#CF4646"]);

let initialPalette = d3
  .scaleLinear()
  .domain([animal_minVal, animal_maxVal])
  .range(["#EFEFFF", "#CF4646"]);
//Creating the Map SVG.
//Map SVG
let width = 700;
let height = 600;

let svg = d3
  .select("#visualization")

  .append("svg")

  .attr("width", width)

  .attr("height", height);

let selectedLayer = svg.append("g").attr("class", "selected-countries");

let layer = svg.append("g").attr("class", "counties");

//Using TopoJson

let countries = topojson.feature(world, world.objects.countries).features;

//first feature is a method of this topojson object and the last . feature is a property of GeoJson object

let boundaries = topojson.mesh(
  world,
  world.objects.countries,
  (a, b) => a !== b
);

//attach properties to each country.
let animals_geoData = countries.map((country) => {
  const totalEndangered = data_animal.get(country.id);

  const totalEndangered_final =
    totalEndangered === undefined
      ? 0
      : Number(String(totalEndangered["Total"]).replace(",", ""));
  TotalofCurrentGroup += totalEndangered_final;
  return {
    ...country,
    properties: {
      totalEndangered: totalEndangered_final,
      selectedNumber: totalEndangered_final,
      fillColor: paletteScale(totalEndangered_final),
      name: totalEndangered === undefined ? "" : totalEndangered["Name"],
      detailedProperties: data_animal.get(country.id),
    },
  };
});

const projection = d3
  .geoMercator()

  .center([10.5, 51.35]) // Germany Centered

  .scale(200)
  .translate([width / 2, height / 2]);

const path = d3.geoPath().projection(projection);

const zoomed = ({ transform }) => {
  layer.attr("transform", transform);

  selectedLayer.attr("transform", transform);
};
let zoom = d3.zoom().scaleExtent([0.5, 40]).on("zoom", zoomed);

svg.call(zoom);

layer
  .selectAll("path")
  .data(animals_geoData)
  .join(
    (enter) => {
      enter
        .append("path")
        .attr("class", (d) => `country ${d.id}`)
        .attr("id", `neededCountries`)
        .attr("d", path)
        .style("fill", (d) => d.properties.fillColor)
        .style("stroke", "none");
    },
    () => {},
    (exit) => {
      exit.remove();
    }
  );

const countriesSelection = layer.selectAll(".country");

countriesSelection;
layer
  .selectAll(".country-boundary")
  .data([boundaries])
  .join(
    (enter) => {
      enter
        .append("path")
        .attr("d", path)
        .attr("class", "country-boundary")
        .style("stroke", "black")
        .style("stroke-width", 1)
        .style("stroke-opacity", 0.3)
        .style("fill", "none");
    },
    () => {},
    (exit) => {
      exit.remove();
    }
  );
const boundriesLayer = layer.selectAll(".country-boundary");

//properties for transfering the data into the BarChart
let selectedData = {
  Mammals: 0,
  Birds: 0,
  Reptiles: 0,
  Amphibians: 0,
  Fishes: 0,
  Molluscs: 0,
  OtherInverts: 0,
  Plants: 0,
  Fungi: 0,
  Chromists: 0,
};

//Creating the tooltip ,, creating the tooltip
let currentGroup = "Total Endangered";
let currentGroupNumber = 0;

const tooltipSelection = d3
  .select("body")

  .append("div")

  .attr("class", "hover-info")

  .style("visibility", "hidden");

let currentCountryName;

let tooltipEventListeners = countriesSelection
  .on("mouseenter", ({ target }) => {
    tooltipSelection.style("visibility", "visible");

    d3.select(target)
      .transition()
      .duration(150)
      .ease(d3.easeCubic)
      .style("fill", "#ffba08");
  })

  .on("mousemove", ({ pageX, pageY, target }) => {
    tooltipSelection
      .style("top", `${pageY + 20}px`)
      .style("left", `${pageX - 10}px`)
      .style("z-index", 100)
      .html(
        `<strong>${target.__data__.properties.name}</strong><br>${currentGroup} = <strong>${target.__data__.properties.selectedNumber}</strong>`
      )
      .append("div")
      .attr("class", "triangle");

    d3.selectAll(".triangle").style("top", `${-Math.sqrt(20) - 3}px`);
  })
  .on("mouseleave", (e) => {
    tooltipSelection.style("visibility", "hidden");

    d3.select(e.target)
      .transition()
      .duration(150)
      .ease(d3.easeCubic)
      .style("fill", (d) => d.properties.fillColor);
  })

  .on("mousedown", (e) => {
    try {
      selectedData = d3.select(e.target).data()[0]
        .properties.detailedProperties;
      selectedData = Object.assign({}, selectedData);
      currentCountryName = selectedData.Name;
      delete selectedData.Name;
      delete selectedData.CountryCode;
      delete selectedData.Total;
      var keys = Object.keys(selectedData);

      keys.map(
        (key) => (selectedData[key] = +selectedData[key].replace(",", ""))
      );
    } catch {}
    if (selectedData != undefined) {
      updateBar(); //Updates the bar chart
    }
  });

//////////////////////////////////////////////////////////////////////barchart//////////////////////////

//selecting the max endangered country
var mydata = Array.from(animals_geoData);

let targetMaxEndangeredCountry = mydata[0];

mydata.map((d) => {
  if (
    d.properties.totalEndangered >
    targetMaxEndangeredCountry.properties.totalEndangered
  ) {
    targetMaxEndangeredCountry = d;
  }
});
targetMaxEndangeredCountry =
  targetMaxEndangeredCountry.properties.detailedProperties;
currentCountryName = targetMaxEndangeredCountry.Name;

delete targetMaxEndangeredCountry.Name;
delete targetMaxEndangeredCountry.CountryCode;
delete targetMaxEndangeredCountry.Total;

var keys = Object.keys(targetMaxEndangeredCountry);

keys.map(
  (key) =>
    (targetMaxEndangeredCountry[key] = +targetMaxEndangeredCountry[key].replace(
      ",",
      ""
    ))
);
selectedData = targetMaxEndangeredCountry;

let animalXdata = Object.keys(selectedData);

var selection = d3.select("#select");

const margin = { top: 30, bottom: 100, left: 70, right: 10 };

//Setting the width and height for SVGs
const width2 = 500;
const height2 = 500;

// //Xscale.
let xScale = d3
  .scaleBand()
  .domain(Object.keys(selectedData))
  .range([0, width2 - margin.left - margin.right]);

//Yscale and its inverse.
let yScale = d3
  .scaleLinear()
  .range([0, height2 - margin.bottom - margin.top])
  .nice();

let yScaleInverse = d3
  .scaleLinear()
  .range([height2 - margin.bottom - margin.top, 0])
  .nice();

//separate SVG for the BarChart as a whole.
var svgBar = d3
  .select("#visualization")
  .append("svg")
  .attr("width", width2)
  .attr("height", height2);

//X-axis title
svgBar
  .append("text")
  .attr("transform", `translate(${width2 / 2}, ${height2 - margin.bottom / 5})`)
  .text("Species")
  .attr("font-size", "18")
  .attr("fill", "red")
  .attr("font-family", "Arial")
  .attr("font-style", "oblique");

//Y-axis title
svgBar
  .append("text")
  .attr("font-size", "18")
  .attr(
    "transform",
    `translate(${margin.left / 4}, ${height / 1.75})rotate(-90)`
  )
  .text("number of endangered speciy")
  .attr("fill", "red")
  .attr("font-family", "Arial")
  .attr("font-style", "oblique");

//Title of the barchart
let barChartTitle = svgBar
  .append("text")
  .attr("font-size", "18")
  .attr("transform", `translate(${width2 / 2}, ${margin.top / 2})`)
  .attr("text-anchor", "middle")
  .attr("fill", "red")
  .attr("font-family", "Arial")
  .attr("font-style", "oblique");

//number Info
let numberInfoText = svgBar
  .append("text")
  .attr("font-size", "14")
  .attr("transform", `translate(${margin.left}, ${margin.top / 2})`)
  .attr("text-anchor", "middle")
  .attr("fill", "black")
  .attr("font-family", "Arial")
  .attr("font-style", "oblique");

// a g to contain all the rectanlges only
var BarsG = svgBar
  .append("g")
  .attr("width", width2 - margin.left - margin.right)
  .attr("height", height2 - margin.bottom - margin.top)
  .attr("transform", `translate(${margin.left}, ${margin.top})`);

// X-Axis
svgBar
  .append("g")
  .attr("transform", `translate(${margin.left}, ${height2 - margin.bottom})`)
  .call(d3.axisBottom(xScale))
  .selectAll("text")
  .attr("transform", `rotate(-90)translate(-30,-15)`);

// Y-Axis
let YAxis = svgBar
  .append("g")
  .call(d3.axisLeft(yScaleInverse))
  .attr("transform", `translate(${margin.left}, ${margin.top})`);

//creating rectangles
BarsG.selectAll("rect")
  .data(animalXdata)
  .join("rect")
  .attr("x", function (d, i) {
    return xScale.bandwidth() * i;
  })
  .attr("width", xScale.bandwidth())
  .attr("stroke", "grey")
  .attr("stroke-width", "2px");

let rectangles = BarsG.selectAll("rect").on("mouseenter", (event) => {
  var speciyName = select(event.target).data();
  numberInfoText.text(`${speciyName} = ${selectedData[speciyName]}`);
  select(event.target).attr("fill", "#ffba08");
});

let paletteScaleBars = d3.scaleLinear(); // define a palette scale for the barchart and update on selection

rectangles.on("mouseleave", (event) => {
  var speciyName = select(event.target).data();
  var speciyValue = selectedData[speciyName];
  select(event.target).attr("fill", paletteScaleBars(speciyValue));
  numberInfoText.text("");
});

let countriesPaths = d3.selectAll("#neededCountries")._groups[0];

rectangles.on("mousedown", (event) => {
  var speciyName = select(event.target).data();
  updateMapColor(speciyName);
});

updateBar(); // update initially

//button logic
d3.select("#myButton").on("click", (event) => {
  updateMapColor("Total");
});

//construct the selection for selecting a species
animalXdata.unshift("Total");
selection
  .selectAll("option")
  .data(animalXdata)
  .join("option")
  .html(function (d) {
    return d;
  });

//when selection changes
selection.on("change", function () {
  updateMapColor(change());
});

////////////////////////////////////////////////////////////////functions section

//update the color according to a selected specice from the barchart or the Total according the input string
function updateMapColor(selectedSspecies) {
  TotalofCurrentGroup = 0;
  //reset palette scale max and minimum
  animal_minVal = 100000000;
  animal_maxVal = 0;

  //get the max and minimum for paletteScale again.
  data_animal.forEach((value) => {
    if (value[selectedSspecies] !== undefined) {
      animal_minVal = Math.min(
        animal_minVal,
        Number(String(value[selectedSspecies]).replace(",", ""))
      );
      animal_maxVal = Math.max(
        animal_maxVal,
        Number(String(value[selectedSspecies]).replace(",", ""))
      );
    }
  });
  paletteScale.domain([animal_minVal, animal_maxVal]);

  countriesPaths.forEach((x) => {
    var prop = d3.select(x).data()[0].properties;

    if (prop.detailedProperties != undefined) {
      let numb = Number(
        String(prop.detailedProperties[selectedSspecies]).replace(",", "")
      );
      currentGroup = selectedSspecies;
      prop.selectedNumber = numb;
      if (selectedSspecies != "Total") {
        TotalofCurrentGroup += numb;
        prop.fillColor = paletteScale(numb);
        d3.select(x).style("fill", paletteScale(numb));
      } else {
        prop.selectedNumber = prop.totalEndangered;
        TotalofCurrentGroup += prop.totalEndangered;
        prop.fillColor = initialPalette(prop.totalEndangered);
        d3.select(x).style("fill", initialPalette(prop.totalEndangered));
      }
    } else {
      d3.select(x).style("fill", initialPalette(0));
    }
  });

  d3.select("#filter").text(
    selectedSspecies + " Around world: " + TotalofCurrentGroup
  );
}
//updating the barchat on each country selection
function updateBar() {
  var NewValues = Object.values(selectedData);

  //update bar title
  barChartTitle.text(currentCountryName);

  paletteScaleBars.domain([0, d3.max(NewValues)]).range(["#dd6666", "#cc0000"]);
  //update Yscale
  yScale.domain([0, d3.max(NewValues)]); //sets the upper end of the input domain to the largest data value in dataset
  BarsG.selectAll("rect")
    .attr("y", function (d) {
      return height2 - margin.bottom - margin.top - yScale(selectedData[d]);
    })
    .attr("height", function (d) {
      return yScale(selectedData[d]);
    })
    .attr("fill", function (d) {
      return paletteScaleBars(selectedData[d]);
    });

  //update YScale inverse
  yScaleInverse.domain([0, d3.max(NewValues)]); //sets the upper end of the input domain to the largest data value in dataset

  YAxis.transition()
    .duration(1000)
    .call(d3.axisLeft(yScaleInverse))
    .selectAll("text")
    .style("text-anchor", "end");
}
//get the current selection
function change() {
  var yourSelect = document.getElementById("select");
  var currnetSelection = yourSelect.options[yourSelect.selectedIndex].value;
  let x = [];
  x.push(currnetSelection);
  return x;
}
