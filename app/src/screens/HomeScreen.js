import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
const formatDate = (value) => {
    if (!value)
        return "Unknown";
    const date = new Date(value);
    if (Number.isNaN(date.getTime()))
        return value;
    return date.toLocaleString();
};
const HomeScreen = ({ plants, speciesCache }) => {
    if (plants.length === 0) {
        return (_jsxs("div", { className: "card", children: [_jsx("h3", { children: "No plants yet" }), _jsx("p", { children: "Add your first plant to see moisture guidance and care policies." })] }));
    }
    return (_jsx("div", { className: "list", children: plants.map((plant) => {
            const profile = plant.speciesProfile ?? speciesCache[plant.speciesKey];
            return (_jsxs("div", { className: "card", children: [_jsx("h3", { children: plant.nickname || profile?.commonName || profile?.canonicalName || "Unnamed Plant" }), _jsxs("p", { children: [_jsx("strong", { children: "Species:" }), " ", profile?.canonicalName ?? plant.speciesKey] }), profile?.commonName && _jsxs("p", { children: [_jsx("strong", { children: "Common:" }), " ", profile.commonName] }), profile?.moisturePolicy && (_jsxs("div", { children: [_jsxs("p", { children: [_jsx("strong", { children: "Water every:" }), " ", profile.moisturePolicy.waterIntervalDays, " days"] }), _jsxs("p", { children: [_jsx("strong", { children: "Soil threshold:" }), " ", profile.moisturePolicy.soilMoistureThreshold, "%"] }), _jsxs("p", { children: [_jsx("strong", { children: "Humidity:" }), " ", profile.moisturePolicy.humidityPreference] }), _jsxs("p", { children: [_jsx("strong", { children: "Light:" }), " ", profile.moisturePolicy.lightRequirement] }), profile.moisturePolicy.notes.length > 0 && (_jsxs("div", { children: [_jsx("strong", { children: "Notes:" }), _jsx("ul", { className: "notes-list", children: profile.moisturePolicy.notes.map((note, index) => (_jsx("li", { children: note }, index))) })] }))] })), _jsxs("p", { children: [_jsx("strong", { children: "Last updated:" }), " ", formatDate(plant.updatedAt)] })] }, plant.id));
        }) }));
};
export default HomeScreen;
