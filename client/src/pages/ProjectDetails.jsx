import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { 
  PlusIcon, 
  UserGroupIcon,
  ClipboardDocumentListIcon,
  CalendarIcon,
  MapPinIcon,
  CurrencyDollarIcon,
  ChartBarIcon,
  LightBulbIcon,
  ShoppingCartIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';

const ProjectDetails = () => {
  const { projectId } = useParams();
  const [project, setProject] = useState(null);
  const [employeeSuggestions, setEmployeeSuggestions] = useState([]);
  const [employeeSuggestReason, setEmployeeSuggestReason] = useState('');
  const [orderSuggestions, setOrderSuggestions] = useState([]);
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [assignmentForm, setAssignmentForm] = useState({
    assigned_hours: '',
    role: '',
    start_date: '',
    end_date: '',
    notes: ''
  });

  useEffect(() => {
    if (projectId) {
      fetchProjectDetails();
      fetchEmployeeSuggestions();
      fetchOrderSuggestions();
    }
  }, [projectId]);

  const fetchProjectDetails = async () => {
    try {
      const response = await fetch(`http://localhost:5001/projects/${projectId}`);
      const data = await response.json();
      setProject(data);
    } catch (error) {
      console.error('Error fetching project details:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployeeSuggestions = async () => {
    try {
      const response = await fetch(`http://localhost:5001/projects/${projectId}/suggest-employees`);
      const data = await response.json();
      if (Array.isArray(data)) {
        setEmployeeSuggestions(data);
        setEmployeeSuggestReason('');
      } else {
        setEmployeeSuggestions(data.suggestions || []);
        setEmployeeSuggestReason(data.reason || '');
      }
    } catch (error) {
      setEmployeeSuggestions([]);
      setEmployeeSuggestReason('');
    }
  };

  const fetchOrderSuggestions = async () => {
    try {
      const response = await fetch(`http://localhost:5001/projects/${projectId}/suggest-orders`);
      const data = await response.json();
      setOrderSuggestions(data);
    } catch (error) {
      console.error('Error fetching order suggestions:', error);
    }
  };

  const handleAssignEmployee = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`http://localhost:5001/projects/${projectId}/assign-employee`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          employee_id: selectedEmployee.employee_id,
          ...assignmentForm
        }),
      });
      
      if (response.ok) {
        setShowEmployeeModal(false);
        setSelectedEmployee(null);
        setAssignmentForm({
          assigned_hours: '',
          role: '',
          start_date: '',
          end_date: '',
          notes: ''
        });
        fetchProjectDetails();
        fetchEmployeeSuggestions();
      }
    } catch (error) {
      console.error('Error assigning employee:', error);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'planning': return 'bg-blue-100 text-blue-800';
      case 'active': return 'bg-green-100 text-green-800';
      case 'on_hold': return 'bg-yellow-100 text-yellow-800';
      case 'completed': return 'bg-gray-100 text-gray-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'low': return 'bg-green-100 text-green-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'urgent': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="p-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">Project not found</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Project Header */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{project.name}</h1>
            <p className="text-gray-600 mt-2">{project.description}</p>
          </div>
          <div className="flex gap-2">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(project.status)}`}>
              {project.status}
            </span>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getPriorityColor(project.priority)}`}>
              {project.priority}
            </span>
          </div>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="flex items-center gap-2">
            <MapPinIcon className="h-5 w-5 text-gray-500" />
            <span className="text-sm text-gray-600">{project.location}</span>
          </div>
          <div className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5 text-gray-500" />
            <span className="text-sm text-gray-600">Deadline: {new Date(project.deadline).toLocaleDateString()}</span>
          </div>
          <div className="flex items-center gap-2">
            <CurrencyDollarIcon className="h-5 w-5 text-gray-500" />
            <span className="text-sm text-gray-600">Budget: ${project.budget?.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-2">
            <ChartBarIcon className="h-5 w-5 text-gray-500" />
            <span className="text-sm text-gray-600">Progress: {project.progress}%</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Requirements Section */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Project Requirements</h2>
              <button
                onClick={() => setShowOrderModal(true)}
                className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded-md text-sm flex items-center gap-1"
              >
                <ShoppingCartIcon className="h-4 w-4" />
                Order Suggestions
              </button>
            </div>
            
            <div className="space-y-4">
              {project.requirements?.map((req) => (
                <div key={req.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-medium text-gray-900">{req.product_name}</h3>
                      <p className="text-sm text-gray-600">SKU: {req.product_sku}</p>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(req.priority)}`}>
                      {req.priority}
                    </span>
                  </div>
                  
                  <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Required:</span>
                      <p className="text-gray-600">{req.quantity_required}</p>
                    </div>
                    <div>
                      <span className="font-medium">Available:</span>
                      <p className="text-gray-600">{req.stock_available}</p>
                    </div>
                    <div>
                      <span className="font-medium">Ordered:</span>
                      <p className="text-gray-600">{req.quantity_ordered}</p>
                    </div>
                    <div>
                      <span className="font-medium">Received:</span>
                      <p className="text-gray-600">{req.quantity_received}</p>
                    </div>
                  </div>
                  
                  {req.needs_ordering && (
                    <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded-md">
                      <div className="flex items-center gap-2">
                        <ExclamationTriangleIcon className="h-4 w-4 text-yellow-600" />
                        <span className="text-sm text-yellow-800">Needs ordering - insufficient stock</span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Smart Suggestions Sidebar */}
        <div className="space-y-6">
          {/* Employee Suggestions */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Smart Employee Suggestions</h3>
              <button
                onClick={() => setShowEmployeeModal(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-md text-sm flex items-center gap-1"
              >
                <PlusIcon className="h-4 w-4" />
                Assign Employee
              </button>
            </div>
            
            <div className="space-y-3">
              {employeeSuggestions.length > 0 ? (
                employeeSuggestions.slice(0, 3).map((suggestion, index) => (
                  <div key={suggestion.employee_id} className="border border-gray-200 rounded-lg p-3">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-medium text-sm">{suggestion.name}</h4>
                      <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                        Score: {suggestion.overall_score.toFixed(2)}
                      </span>
                    </div>
                    
                    <div className="text-xs text-gray-600 space-y-1">
                      <p>Rate: ${suggestion.hourly_rate}/hr</p>
                      <p>Efficiency: {suggestion.efficiency_rating}</p>
                      <p>Available: {suggestion.available_hours}h</p>
                      {suggestion.location_match && (
                        <p className="text-green-600 font-medium">✓ Location match</p>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-gray-500 text-sm">{employeeSuggestReason ? employeeSuggestReason : 'No suggestions yet.'}</div>
              )}
            </div>
          </div>

          {/* Order Suggestions */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Order Recommendations</h3>
            
            <div className="space-y-3">
              {orderSuggestions.slice(0, 3).map((suggestion) => (
                <div key={suggestion.requirement_id} className="border border-gray-200 rounded-lg p-3">
                  <h4 className="font-medium text-sm mb-2">{suggestion.product_name}</h4>
                  <div className="text-xs text-gray-600 space-y-1">
                    <p>Needed: {suggestion.quantity_needed}</p>
                    <p>Cost: ${suggestion.unit_cost}</p>
                    <p className="text-orange-600 font-medium">Priority: {suggestion.priority}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Team Assignments */}
      <div className="mt-6 bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Team Assignments</h2>
        
        {project.assignments?.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {project.assignments.map((assignment) => (
              <div key={assignment.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-medium text-gray-900">{assignment.employee_name}</h3>
                    <p className="text-sm text-gray-600">{assignment.role}</p>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${assignment.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                    {assignment.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Assigned Hours:</span>
                    <span className="font-medium">{assignment.assigned_hours}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Actual Hours:</span>
                    <span className="font-medium">{assignment.actual_hours}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Performance:</span>
                    <span className="font-medium">{assignment.performance_rating}/5</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <UserGroupIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No team assignments yet</p>
            <button
              onClick={() => setShowEmployeeModal(true)}
              className="mt-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm"
            >
              Assign Team Members
            </button>
          </div>
        )}
      </div>

      {/* Assign Employee Modal */}
      {showEmployeeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">Assign Employee to Project</h2>
            
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-3">Recommended Employees</h3>
              <div className="space-y-3">
                {employeeSuggestions.length > 0 ? (
                  employeeSuggestions.map((suggestion) => (
                    <div
                      key={suggestion.employee_id}
                      onClick={() => setSelectedEmployee(suggestion)}
                      className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                        selectedEmployee?.employee_id === suggestion.employee_id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-medium">{suggestion.name}</h4>
                          <p className="text-sm text-gray-600">{suggestion.email}</p>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-medium text-green-600">
                            Score: {suggestion.overall_score.toFixed(2)}
                          </span>
                          <p className="text-xs text-gray-500">${suggestion.hourly_rate}/hr</p>
                        </div>
                      </div>
                      
                      <div className="mt-2 text-xs text-gray-600">
                        <p>Skills: {suggestion.skills}</p>
                        <p>Available: {suggestion.available_hours}h/week</p>
                        <p>Location: {suggestion.location}</p>
                        {suggestion.location_match && (
                          <p className="text-green-600 font-medium">✓ Location match</p>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-gray-500 text-sm">{employeeSuggestReason ? employeeSuggestReason : 'No suggestions yet.'}</div>
                )}
              </div>
            </div>
            
            {selectedEmployee && (
              <form onSubmit={handleAssignEmployee} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Assigned Hours</label>
                    <input
                      type="number"
                      required
                      value={assignmentForm.assigned_hours}
                      onChange={(e) => setAssignmentForm({...assignmentForm, assigned_hours: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                    <input
                      type="text"
                      value={assignmentForm.role}
                      onChange={(e) => setAssignmentForm({...assignmentForm, role: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                    <input
                      type="date"
                      value={assignmentForm.start_date}
                      onChange={(e) => setAssignmentForm({...assignmentForm, start_date: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                    <input
                      type="date"
                      value={assignmentForm.end_date}
                      onChange={(e) => setAssignmentForm({...assignmentForm, end_date: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <textarea
                    value={assignmentForm.notes}
                    onChange={(e) => setAssignmentForm({...assignmentForm, notes: e.target.value})}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                
                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md font-medium"
                  >
                    Assign Employee
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowEmployeeModal(false)}
                    className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 py-2 px-4 rounded-md font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Order Suggestions Modal */}
      {showOrderModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-6">
              <h2 className="text-2xl font-bold">Order Recommendations</h2>
              <button
                onClick={() => setShowOrderModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-6">
              {orderSuggestions.map((suggestion) => (
                <div key={suggestion.requirement_id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-semibold">{suggestion.product_name}</h3>
                      <p className="text-sm text-gray-600">SKU: {suggestion.product_sku}</p>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(suggestion.priority)}`}>
                      {suggestion.priority}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 text-sm">
                    <div>
                      <span className="font-medium">Required:</span>
                      <p className="text-gray-600">{suggestion.quantity_required}</p>
                    </div>
                    <div>
                      <span className="font-medium">Available:</span>
                      <p className="text-gray-600">{suggestion.stock_available}</p>
                    </div>
                    <div>
                      <span className="font-medium">Needed:</span>
                      <p className="text-red-600 font-medium">{suggestion.quantity_needed}</p>
                    </div>
                    <div>
                      <span className="font-medium">Unit Cost:</span>
                      <p className="text-gray-600">${suggestion.unit_cost}</p>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-medium mb-2">Order Options:</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {suggestion.order_suggestions.map((option, index) => (
                        <div key={index} className="border border-gray-200 rounded-lg p-3">
                          <h5 className="font-medium text-sm mb-1">{option.type.replace('_', ' ').toUpperCase()}</h5>
                          <p className="text-xs text-gray-600 mb-2">{option.description}</p>
                          <div className="text-sm">
                            <p><span className="font-medium">Quantity:</span> {option.quantity}</p>
                            <p><span className="font-medium">Cost:</span> ${option.cost.toLocaleString()}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectDetails; 