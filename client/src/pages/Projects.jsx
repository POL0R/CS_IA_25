import React, { useState, useEffect } from 'react';
import { 
  PlusIcon, 
  EyeIcon, 
  PencilIcon, 
  TrashIcon,
  UserGroupIcon,
  ClipboardDocumentListIcon,
  CalendarIcon,
  MapPinIcon,
  CurrencyDollarIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline';
import './ProjectsIcons.css';
import './Projects.css';
import mapboxgl from 'mapbox-gl';
import MapboxGeocoder from '@mapbox/mapbox-gl-geocoder';
import mbxDirections from '@mapbox/mapbox-sdk/services/directions';
import mbxGeocoding from '@mapbox/mapbox-sdk/services/geocoding';
import { useRef } from 'react';
import axios from 'axios';
import Select from 'react-select/creatable';

// Helper to safely display skills as a comma-separated string
function getSkillsString(skills) {
  if (Array.isArray(skills)) return skills.join(', ');
  if (typeof skills === 'string') {
    try { return JSON.parse(skills).join(', '); } catch { return skills; }
  }
  return '';
}

const PROJECT_STATUSES = [
  'incoming', 'processing', 'transit', 'on_hold', 'completed', 'cancelled'
];
const STATUS_LABELS = {
  incoming: 'Incoming',
  processing: 'Processing',
  transit: 'Transit',
  on_hold: 'On Hold',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const Projects = () => {
  const [projects, setProjects] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showProjectDetails, setShowProjectDetails] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    priority: 'medium',
    budget: '',
    start_date: '',
    deadline: '',
    location: '',
    transportation_cost: ''
  });
  const [suggestedEmployees, setSuggestedEmployees] = useState([]);
  const [suggestReason, setSuggestReason] = useState('');
  const [suggesting, setSuggesting] = useState(false);
  const [requirements, setRequirements] = useState([]);
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [location, setLocation] = useState({ address: '', lat: null, lng: null });
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN;
  const [calculatingCost, setCalculatingCost] = useState(false);
  const [costError, setCostError] = useState('');
  const [finishedProducts, setFinishedProducts] = useState([]);

  // New state for the project completion date feature
  const [tasks, setTasks] = useState([{ name: '', duration_days: '', dependencies: [] }]);
  const [workingHours, setWorkingHours] = useState(8);
  const [holidays, setHolidays] = useState([]);
  const [clientDeadline, setClientDeadline] = useState('');
  const [approvalBuffer, setApprovalBuffer] = useState(0);
  const [predictedEndDate, setPredictedEndDate] = useState(null);
  const [projectType, setProjectType] = useState('Standard');
  const [assignedTeam, setAssignedTeam] = useState([]);
  const [materialRequirements, setMaterialRequirements] = useState([
    { task_id: 0, item_name: '', quantity: '', in_stock: true, lead_time: 0 }
  ]);


  // Move these useState declarations above the useEffect that uses them
  const [selectedWarehouse, setSelectedWarehouse] = useState(null);
  const [vehicleType, setVehicleType] = useState('Truck');
  const [weight, setWeight] = useState('');
  const [selectedEmployees, setSelectedEmployees] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    if (showCreateModal) {
      fetch('http://localhost:5001/finished_products').then(res => res.json()).then(setFinishedProducts);
      fetch('http://localhost:5001/warehouses').then(res => res.json()).then(setWarehouses);
      fetch('http://localhost:5001/holidays').then(res => res.json()).then(setHolidays);
    }
  }, [showCreateModal]);

  useEffect(() => {
    if (!showCreateModal || !mapboxToken || !mapContainer.current) return;
    if (mapRef.current) return;
    mapboxgl.accessToken = mapboxToken;
    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v11',
      center: [location.lng || 77.209, location.lat || 28.6139],
      zoom: location.lng && location.lat ? 12 : 4
    });
    mapRef.current = map;
    const geocoder = new MapboxGeocoder({
      accessToken: mapboxToken,
      mapboxgl: mapboxgl,
      marker: false,
      placeholder: 'Search project location...'
    });
    map.addControl(geocoder);
    geocoder.on('result', (e) => {
      const { center, place_name } = e.result;
      setLocation({ lng: center[0], lat: center[1], address: place_name });
      setFormData(f => ({ ...f, location: place_name })); // Update formData.location
      if (markerRef.current) markerRef.current.remove();
      markerRef.current = new mapboxgl.Marker().setLngLat(center).addTo(map);
      map.flyTo({ center, zoom: 12 });
    });
    map.on('click', (e) => {
      const { lng, lat } = e.lngLat;
      setLocation(loc => ({ ...loc, lng, lat }));
      if (markerRef.current) markerRef.current.remove();
      markerRef.current = new mapboxgl.Marker().setLngLat([lng, lat]).addTo(map);
      fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${mapboxToken}`)
        .then(res => res.json())
        .then(data => {
          const place = data.features[0]?.place_name || '';
          setLocation(loc => ({ ...loc, address: place }));
          setFormData(f => ({ ...f, location: place })); // Update formData.location
        });
    });
    if (location.lng && location.lat) {
      const center = [location.lng, location.lat];
      markerRef.current = new mapboxgl.Marker().setLngLat(center).addTo(map);
      map.setCenter(center);
      map.setZoom(12);
    }
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [showCreateModal, mapboxToken]);

  useEffect(() => {
    async function calculateTransportCost() {
      setCostError('');
      if (!selectedWarehouse || !selectedWarehouse.lat || !selectedWarehouse.lng || !location.lat || !location.lng || !weight) return;
      setCalculatingCost(true);
      try {
        // Use Mapbox Directions API for real road distance and duration
        const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN;
        const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${selectedWarehouse.lng},${selectedWarehouse.lat};${location.lng},${location.lat}?access_token=${mapboxToken}`;
        const mapboxRes = await fetch(url);
        const mapboxData = await mapboxRes.json();
        if (!mapboxData.routes || !mapboxData.routes[0]) throw new Error('No route found');
        const route = mapboxData.routes[0];
        const distance = route.distance / 1000; // meters to km
        const duration = route.duration / 3600; // seconds to hours
        let cost = 0;
        if (vehicleType === 'Truck') {
          console.log('Calling /predict_truck_cost with distance:', distance);
          const res = await fetch(`http://localhost:5001/predict_truck_cost?distance_km=${distance}`);
          const data = await res.json();
          console.log('Truck cost API response:', data);
          cost = Math.round(data.predicted_cost_inr);
        } else {
          // Tempo calculation (simple formula)
          const driverHourlyRate = 30;
          const petrolPrice = 90;
          const truckSpeed = 25;
          const mileage = 18;
          const maxDrivingHoursPerDay = 12;
          const totalHours = duration;
          const fullDays = Math.floor(totalHours / maxDrivingHoursPerDay);
          const drivingHours = fullDays * maxDrivingHoursPerDay + Math.min(maxDrivingHoursPerDay, totalHours % maxDrivingHoursPerDay);
          const restHours = totalHours - drivingHours;
          const driverCost = (drivingHours * driverHourlyRate) + (restHours * driverHourlyRate / 3);
        const fuelNeeded = distance / mileage;
          cost = Math.round(driverCost + petrolPrice * fuelNeeded);
        }
        setFormData(f => ({ ...f, transportation_cost: cost }));
      } catch (err) {
        setCostError(err.message);
      } finally {
        setCalculatingCost(false);
      }
    }
    calculateTransportCost();
    // eslint-disable-next-line
  }, [selectedWarehouse, location.lat, location.lng, weight, vehicleType]);

  // When requirements change, update total weight
  useEffect(() => {
    if (!showCreateModal) return;
    let totalWeight = 0;
    for (const req of requirements) {
      const prod = finishedProducts.find(p => p.id === Number(req.product_id));
      if (prod && prod.weight && req.quantity_required) {
        totalWeight += prod.weight * Number(req.quantity_required);
      }
    }
    setWeight(totalWeight ? totalWeight.toFixed(2) : '');
  }, [requirements, finishedProducts, showCreateModal]);

  // When requirements or weight change, auto-select vehicle type
  useEffect(() => {
    if (!showCreateModal) return;
    const w = parseFloat(weight);
    if (!isNaN(w)) {
      if (w < 100 && vehicleType !== 'Tempo') setVehicleType('Tempo');
      if (w >= 100 && vehicleType !== 'Truck') setVehicleType('Truck');
    }
  }, [weight, showCreateModal]);

  // Remove all logic and UI related to /porter-estimate and automatic transportation cost calculation
  // - Remove useEffect that calls /porter-estimate
  // - Remove distance, distanceLoading, distanceError state
  // - Remove UI that shows calculated transportation cost, distance, or loading/error for it
  // - The transportation cost field should be a normal input (not readOnly)

  const fetchProjects = async () => {
    try {
      const response = await fetch('http://localhost:5001/projects');
      const data = await response.json();
      setProjects(data);
    } catch (error) {
      console.error('Error fetching projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('http://localhost:5001/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          lat: location.lat,
          lng: location.lng,
          delegate_employees: selectedEmployees
        }),
      });
      
      if (response.ok) {
        setShowCreateModal(false);
        setFormData({
          name: '',
          description: '',
          priority: 'medium',
          budget: '',
          start_date: '',
          deadline: '',
          location: '',
          transportation_cost: ''
        });
        setSelectedEmployees([]);
        fetchProjects();
      }
    } catch (error) {
      console.error('Error creating project:', error);
    }
  };

  const handleViewProject = async (projectId) => {
    try {
      const response = await fetch(`http://localhost:5001/projects/${projectId}`);
      const data = await response.json();
      setSelectedProject(data);
      setShowProjectDetails(true);
    } catch (error) {
      console.error('Error fetching project details:', error);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'incoming': return 'badge badge-status-incoming';
      case 'processing': return 'badge badge-status-processing';
      case 'transit': return 'badge badge-status-transit';
      case 'on_hold': return 'badge badge-status-on_hold';
      case 'completed': return 'badge badge-status-completed';
      case 'cancelled': return 'badge badge-status-cancelled';
      default: return 'badge';
    }
  };
  const getPriorityBadge = (priority) => {
    switch (priority) {
      case 'low': return 'badge badge-priority-low';
      case 'medium': return 'badge badge-priority-medium';
      case 'high': return 'badge badge-priority-high';
      case 'urgent': return 'badge badge-priority-urgent';
      default: return 'badge';
    }
  };

  // Fetch suggested employees for a project
  const fetchSuggestedEmployees = async (projectId) => {
    setSuggesting(true);
    try {
      const response = await fetch(`http://localhost:5001/projects/${projectId}/suggest-employees`);
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) {
          setSuggestedEmployees(data);
          setSuggestReason('');
        } else {
          setSuggestedEmployees(data.suggestions || []);
          setSuggestReason(data.reason || '');
        }
      } else {
        setSuggestedEmployees([]);
        setSuggestReason('');
      }
    } catch (error) {
      setSuggestedEmployees([]);
      setSuggestReason('');
    } finally {
      setSuggesting(false);
    }
  };

  const handleAddRequirement = () => {
    setRequirements([...requirements, { product_id: '', quantity_required: 1 }]);
  };
  const handleRequirementChange = (idx, field, value) => {
    setRequirements(reqs => reqs.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  };
  const handleRemoveRequirement = (idx) => {
    setRequirements(reqs => reqs.filter((_, i) => i !== idx));
  };

  // Helper functions for the new dynamic fields
  const handleTaskChange = (index, field, value) => {
    const newTasks = [...tasks];
    newTasks[index][field] = value;
    setTasks(newTasks);
  };

  const addTask = () => {
    setTasks([...tasks, { name: '', duration_days: '', dependencies: [] }]);
  };

  const removeTask = (index) => {
    setTasks(tasks.filter((_, i) => i !== index));
  };

  const handleMaterialChange = (index, field, value) => {
    const newMaterials = [...materialRequirements];
    newMaterials[index][field] = value;
    setMaterialRequirements(newMaterials);
  };

  const addMaterial = () => {
    setMaterialRequirements([...materialRequirements, { task_id: 0, item_name: '', quantity: '', in_stock: true, lead_time: 0 }]);
  };

  const removeMaterial = (index) => {
    setMaterialRequirements(materialRequirements.filter((_, i) => i !== index));
  };

  const handlePredict = async () => {
    const projectData = {
      start_date: formData.start_date,
      tasks: tasks.map(t => ({ ...t, duration_days: Number(t.duration_days) })),
      working_hours_per_day: Number(workingHours),
      holidays: holidays.map(h => h.date),
      material_requirements: materialRequirements.map(m => ({
        ...m,
        quantity: Number(m.quantity),
        lead_time: Number(m.lead_time)
      })),
      approval_buffer_days: Number(approvalBuffer)
    };
    try {
      const response = await fetch('http://localhost:5001/projects/predict-end-date', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(projectData)
      });
      const data = await response.json();
      if (response.ok) {
        setPredictedEndDate(data.predicted_end_date);
      } else {
        console.error('Error predicting end date:', data.error);
      }
    } catch (error) {
      console.error('Error predicting end date:', error);
    }
  };


  const fetchEmployeeSuggestionsForModal = async () => {
    setSuggesting(true);
    setSuggestedEmployees([]);
    setSuggestReason('');
    try {
      const response = await fetch('http://localhost:5001/projects/suggest-employees-for-new', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requirements,
          location: formData.location
        })
      });
      const data = await response.json();
      setSuggestedEmployees(data.suggestions || []);
      setSuggestReason(data.reason || '');
    } catch (error) {
      setSuggestedEmployees([]);
      setSuggestReason('');
    } finally {
      setSuggesting(false);
    }
  };

  // Filter projects by status
  const filteredProjects = statusFilter === 'all' ? projects : projects.filter(p => p.status === statusFilter);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="projects-wrapper">
      <div className="projects-container">
        <div className="projects-header">
          <h1 className="projects-title">Project Management</h1>
          <button
            onClick={() => setShowCreateModal(true)}
            className="project-card-btn"
          >
            <PlusIcon className="icon-main" />
            New Project
          </button>
        </div>
        {/* Status Tabs */}
        <div className="projects-status-tabs" style={{ display: 'flex', gap: 12, margin: '16px 0' }}>
          <button
            className={`status-tab${statusFilter === 'all' ? ' active' : ''}`}
            onClick={() => setStatusFilter('all')}
          >All</button>
          {PROJECT_STATUSES.map(status => (
            <button
              key={status}
              className={`status-tab${statusFilter === status ? ' active' : ''}`}
              onClick={() => setStatusFilter(status)}
            >
              {STATUS_LABELS[status]}
            </button>
          ))}
        </div>
        {filteredProjects.length === 0 ? (
          <div style={{textAlign: 'center', padding: '80px 0'}}>
            <svg width="80" height="80" fill="none" viewBox="0 0 24 24" style={{marginBottom: 16, color: '#c7d2fe'}}><rect width="100%" height="100%" rx="12" fill="currentColor"/></svg>
            <p style={{fontSize: '1.1rem', color: '#64748b', marginBottom: 8}}>No projects yet.</p>
            <p style={{color: '#94a3b8', marginBottom: 24}}>Start by creating your first project.</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="project-card-btn"
            >
              <PlusIcon className="icon-main" /> New Project
            </button>
          </div>
        ) : (
          <div className="projects-grid">
            {filteredProjects.map((project) => (
              <div key={project.id} className="project-card">
                <div className="project-card-header">
                  <h3 className="project-card-title">{project.name}</h3>
                  <div className="project-card-statuses">
                    <span className={getStatusBadge(project.status)}>{STATUS_LABELS[project.status] || project.status}</span>
                    <span className={getPriorityBadge(project.priority)}>{project.priority}</span>
                  </div>
                </div>
                <p className="project-card-desc">{project.description}</p>
                <div className="project-card-info">
                  <div className="project-card-info-row">
                    <MapPinIcon className="icon-info" />
                    <span>{project.location}</span>
                  </div>
                  <div className="project-card-info-row">
                    <CalendarIcon className="icon-info" />
                    <span>Deadline: {new Date(project.deadline).toLocaleDateString()}</span>
                  </div>
                  <div className="project-card-info-row">
                    <CurrencyDollarIcon className="icon-info" />
                    <span>Budget: ${project.budget?.toLocaleString()}</span>
                  </div>
                  <div className="project-card-info-row">
                    <ChartBarIcon className="icon-info" />
                    <span>Progress: {project.progress}%</span>
                  </div>
                  {/* New: Total Price and Transportation Cost */}
                  <div className="project-card-info-row">
                    <span style={{fontWeight: 500}}>Total Price:</span>
                    <span>${project.total_cost?.toLocaleString() ?? 'N/A'}</span>
                  </div>
                  <div className="project-card-info-row">
                    <span style={{fontWeight: 500}}>Transportation Cost:</span>
                    <span>${project.transportation_cost?.toLocaleString() ?? 'N/A'}</span>
                  </div>
                </div>
                <div className="project-card-meta">
                  <span style={{display: 'flex', alignItems: 'center', gap: 4}}>
                    <ClipboardDocumentListIcon className="icon-info" />
                    {project.requirements_count} reqs
                  </span>
                  <span style={{display: 'flex', alignItems: 'center', gap: 4}}>
                    <UserGroupIcon className="icon-info" />
                    {project.assignments_count} team
                  </span>
                </div>
                <button
                  onClick={() => handleViewProject(project.id)}
                  className="project-card-btn"
                >
                  <EyeIcon className="icon-main" />
                  View Details
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal overlay for create project */}
      {showCreateModal && (
        <div className="projects-modal-overlay">
          <div className="projects-modal" style={{ maxWidth: 900, width: '90vw', minWidth: 700 }}>
            <h2 className="projects-modal-title">Create New Project</h2>
            <form onSubmit={handleCreateProject} className="projects-form" style={{ display: 'flex', flexDirection: 'row', gap: 32 }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 18 }}>
                {/* Column 1: Project Details & Timeline */}
                <div>
                  <label>Project Name</label>
                  <input type="text" required value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
                </div>
                <div>
                  <label>Description</label>
                  <textarea value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} rows={3} />
                </div>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <div style={{ flex: 1 }}>
                    <label>Start Date</label>
                    <input type="date" value={formData.start_date} onChange={(e) => setFormData({...formData, start_date: e.target.value})} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label>Client Deadline (Optional)</label>
                    <input type="date" value={clientDeadline} onChange={(e) => setClientDeadline(e.target.value)} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '16px' }}>
                   <div style={{ flex: 1 }}>
                    <label>Working Hours per Day</label>
                    <input type="number" value={workingHours} onChange={(e) => setWorkingHours(e.target.value)} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label>Approval Buffer (days)</label>
                    <input type="number" value={approvalBuffer} onChange={(e) => setApprovalBuffer(e.target.value)} />
                  </div>
                </div>
                <div>
                  <label>Task List</label>
                  {tasks.map((task, index) => (
                    <div key={index} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                      <input type="text" placeholder="Task Name" value={task.name} onChange={(e) => handleTaskChange(index, 'name', e.target.value)} style={{ flex: 2 }} />
                      <input type="number" placeholder="Duration (days)" value={task.duration_days} onChange={(e) => handleTaskChange(index, 'duration_days', e.target.value)} style={{ width: '120px' }} />
                      <button type="button" onClick={() => removeTask(index)} style={{ color: 'red', background: 'none', border: 'none', fontWeight: 600 }}>Remove</button>
                    </div>
                  ))}
                  <button type="button" onClick={addTask} className="project-card-btn" style={{ marginTop: 4 }}>+ Add Task</button>
                </div>
                 <div>
                  <label>Holidays</label>
                  <div style={{ maxHeight: '100px', overflowY: 'auto', border: '1px solid #ccc', padding: '8px', borderRadius: '4px' }}>
                    {holidays.map(holiday => (
                      <div key={holiday.id}>{holiday.name} - {new Date(holiday.date).toLocaleDateString()}</div>
                    ))}
                  </div>
                </div>
                <div>
                  <button type="button" onClick={handlePredict} className="project-card-btn">Calculate End Date</button>
                  {predictedEndDate && (
                    <div style={{ marginTop: '16px', fontWeight: 'bold' }}>
                      Predicted End Date: {new Date(predictedEndDate).toLocaleDateString()}
                    </div>
                  )}
                </div>
              </div>

              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 18 }}>
                {/* Column 2: Logistics & Financials */}
                <div style={{ display: 'flex', gap: '16px' }}>
                  <div style={{ flex: 1 }}>
                    <label>Priority</label>
                    <select value={formData.priority} onChange={(e) => setFormData({...formData, priority: e.target.value})}>
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label>Budget ($)</label>
                    <input type="number" value={formData.budget} onChange={(e) => setFormData({...formData, budget: e.target.value})} />
                  </div>
                </div>
                <div>
                  <label>Warehouse (Pickup Point)</label>
                  <select value={selectedWarehouse?.id || ''} onChange={e => setSelectedWarehouse(warehouses.find(w => w.id === Number(e.target.value)))}>
                    <option value="">Select Warehouse</option>
                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </div>
                <div>
                  <label>Location (Destination)</label>
                  <div ref={mapContainer} style={{ width: '100%', height: 150, borderRadius: 8, marginBottom: 8 }} />
                </div>
                <div>
                  <label>Material/Stock Requirements</label>
                  {materialRequirements.map((material, index) => (
                    <div key={index} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                      <input type="text" placeholder="Item Name" value={material.item_name} onChange={(e) => handleMaterialChange(index, 'item_name', e.target.value)} style={{ flex: 2 }} />
                      <input type="number" placeholder="Qty" value={material.quantity} onChange={(e) => handleMaterialChange(index, 'quantity', e.target.value)} style={{ width: '70px' }} />
                      <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        In-Stock:
                        <input type="checkbox" checked={material.in_stock} onChange={(e) => handleMaterialChange(index, 'in_stock', e.target.checked)} />
                      </label>
                      {!material.in_stock && (
                        <input type="number" placeholder="Lead Time" value={material.lead_time} onChange={(e) => handleMaterialChange(index, 'lead_time', e.target.value)} style={{ width: '100px' }} />
                      )}
                      <button type="button" onClick={() => removeMaterial(index)} style={{ color: 'red', background: 'none', border: 'none', fontWeight: 600 }}>X</button>
                    </div>
                  ))}
                  <button type="button" onClick={addMaterial} className="project-card-btn" style={{ marginTop: 4 }}>+ Add Material</button>
                </div>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <div style={{ flex: 1 }}>
                    <label>Total Weight (kg)</label>
                    <input type="number" value={weight} readOnly />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label>Vehicle Type</label>
                    <input type="text" value={vehicleType} readOnly />
                  </div>
                </div>
                <div>
                  <label>Transportation Cost ($)</label>
                  <input type="number" value={formData.transportation_cost} onChange={(e) => setFormData({...formData, transportation_cost: e.target.value})} />
                </div>
                <div className="projects-form-btns" style={{ marginTop: 'auto' }}>
                  <button type="submit" className="projects-form-btn-primary">Create Project</button>
                  <button type="button" onClick={() => setShowCreateModal(false)} className="projects-form-btn-secondary">Cancel</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Modal overlay for project details */}
      {showProjectDetails && selectedProject && (
        <div className="projects-modal-overlay">
          <div className="projects-modal" style={{maxWidth: 900}}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24}}>
              <h2 className="projects-modal-title" style={{marginBottom: 0}}>{selectedProject.name}</h2>
              <button
                onClick={() => setShowProjectDetails(false)}
                style={{background: 'none', border: 'none', fontSize: 28, color: '#64748b', cursor: 'pointer', marginLeft: 12}}
                aria-label="Close"
              >
                &times;
              </button>
            </div>
            <div style={{display: 'grid', gridTemplateColumns: '1fr', gap: 24}}>
              {/* Project Info */}
              <div>
                <h3 style={{fontSize: '1.1rem', fontWeight: 600, marginBottom: 12}}>Project Information</h3>
                <div style={{display: 'flex', flexDirection: 'column', gap: 10}}>
                  <div><span style={{fontWeight: 500}}>Description:</span> <span style={{color: '#64748b'}}>{selectedProject.description}</span></div>
                  <div><span style={{fontWeight: 500}}>Status:</span> <span className={getStatusBadge(selectedProject.status)}>{selectedProject.status}</span></div>
                  <div><span style={{fontWeight: 500}}>Priority:</span> <span className={getPriorityBadge(selectedProject.priority)}>{selectedProject.priority}</span></div>
                  <div><span style={{fontWeight: 500}}>Budget:</span> <span style={{color: '#64748b'}}>${selectedProject.budget?.toLocaleString()}</span></div>
                  <div><span style={{fontWeight: 500}}>Total Cost:</span> <span style={{color: '#64748b'}}>${selectedProject.total_cost?.toLocaleString()}</span></div>
                  <div><span style={{fontWeight: 500}}>Transportation Cost:</span> <span style={{color: '#64748b'}}>${selectedProject.transportation_cost?.toLocaleString()}</span></div>
                  <div><span style={{fontWeight: 500}}>Progress:</span> <span style={{color: '#64748b'}}>{selectedProject.progress}%</span></div>
                  <div><span style={{fontWeight: 500}}>Location:</span> <span style={{color: '#64748b'}}>{selectedProject.location}</span></div>
                  <div><span style={{fontWeight: 500}}>Deadline:</span> <span style={{color: '#64748b'}}>{new Date(selectedProject.deadline).toLocaleDateString()}</span></div>
                </div>
              </div>
              {/* Requirements */}
              <div>
                <h3 style={{fontSize: '1.1rem', fontWeight: 600, marginBottom: 12}}>Requirements</h3>
                <div style={{display: 'flex', flexDirection: 'column', gap: 10}}>
                  {selectedProject.requirements?.map((req) => (
                    <div key={req.id} style={{border: '1px solid #e5e7eb', borderRadius: 8, padding: 12}}>
                      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'}}>
                        <div>
                          <div style={{fontWeight: 500}}>{req.product_name}</div>
                          <div style={{fontSize: 13, color: '#64748b'}}>SKU: {req.product_sku}</div>
                        </div>
                        <span className={getPriorityBadge(req.priority)}>{req.priority}</span>
                      </div>
                      <div style={{marginTop: 8, fontSize: 13, color: '#64748b'}}>
                        <div>Required: {req.quantity_required}</div>
                        <div>Available: {req.stock_available}</div>
                        <div>Needs Ordering: {req.needs_ordering ? 'Yes' : 'No'}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            {/* Assignments */}
            <div style={{marginTop: 24}}>
              <h3 style={{fontSize: '1.1rem', fontWeight: 600, marginBottom: 12}}>Team Assignments</h3>
              <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12}}>
                {selectedProject.assignments?.map((assignment) => (
                  <div key={assignment.id} style={{border: '1px solid #e5e7eb', borderRadius: 8, padding: 12}}>
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'}}>
                      <div>
                        <div style={{fontWeight: 500}}>{assignment.employee_name}</div>
                        <div style={{fontSize: 13, color: '#64748b'}}>{assignment.role}</div>
                      </div>
                      <span className={assignment.is_active ? 'badge badge-status-active' : 'badge badge-status-completed'}>{assignment.is_active ? 'Active' : 'Inactive'}</span>
                    </div>
                    <div style={{marginTop: 8, fontSize: 13, color: '#64748b'}}>
                      <div>Assigned Hours: {assignment.assigned_hours}</div>
                      <div>Actual Hours: {assignment.actual_hours}</div>
                      <div>Performance Rating: {assignment.performance_rating}/5</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {/* Suggested Employees Section */}
            <div style={{marginTop: 32}}>
              <h3 style={{fontSize: '1.1rem', fontWeight: 600, marginBottom: 12}}>Suggested Employees</h3>
              <button
                onClick={() => fetchSuggestedEmployees(selectedProject.id)}
                className="project-card-btn"
                disabled={suggesting}
                style={{marginBottom: 12, opacity: suggesting ? 0.7 : 1}}
              >
                {suggesting ? 'Analyzing...' : 'Suggest Employees'}
              </button>
              {suggestedEmployees.length > 0 ? (
                <ul style={{paddingLeft: 0, listStyle: 'none'}}>
                  {suggestedEmployees.map(emp => (
                    <li key={emp.id} style={{marginBottom: 8, padding: 8, border: '1px solid #e5e7eb', borderRadius: 6}}>
                      <div style={{fontWeight: 500}}>{emp.name} <span style={{color: '#64748b', fontWeight: 400}}>({emp.role})</span></div>
                      <div style={{fontSize: 13, color: '#64748b'}}>Skills: {getSkillsString(emp.skills)}</div>
                      <div style={{fontSize: 13, color: '#64748b'}}>Availability: {emp.availability}</div>
                    </li>
                  ))}
                </ul>
              ) : suggesting ? null : (
                <div style={{color: '#64748b', fontSize: 14}}>{suggestReason ? suggestReason : 'No suggestions yet. Click the button above.'}</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Projects; 