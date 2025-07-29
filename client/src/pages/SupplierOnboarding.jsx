import React, { useState, useRef, useEffect } from 'react';
import mapboxgl from 'mapbox-gl';
import MapboxGeocoder from '@mapbox/mapbox-gl-geocoder';
import '@mapbox/mapbox-gl-geocoder/dist/mapbox-gl-geocoder.css';

const steps = [
  'Basic Info',
  'Company Info',
  'Location',
  'Materials'
];

const boxStyle = {
  maxWidth: 650,
  margin: '40px auto',
  padding: 40,
  background: '#f7fafc',
  borderRadius: 14,
  boxShadow: '0 2px 16px #0002',
  color: '#222',
};
const labelStyle = { color: '#222', fontWeight: 500, marginBottom: 4, display: 'block' };
const inputStyle = {
  width: '100%',
  padding: '12px 14px',
  fontSize: 17,
  border: '1px solid #d1d5db',
  borderRadius: 8,
  marginBottom: 16,
  color: '#222',
  background: '#fff',
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border 0.2s',
};
const errorStyle = { color: '#d90429', fontSize: 14, marginBottom: 8 };
const buttonStyle = {
  padding: '12px 28px',
  fontSize: 17,
  borderRadius: 8,
  border: 'none',
  background: '#222',
  color: '#fff',
  fontWeight: 600,
  cursor: 'pointer',
  marginRight: 12,
  marginTop: 8,
};

export default function SupplierOnboarding({ onComplete, user, profile }) {
  // Prefer profile, then user, then empty string
  const initialName = profile?.name || user?.name || user?.username || '';
  const initialEmail = profile?.email || user?.email || '';
  const initialPhone = profile?.phone || user?.phone || '';
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    name: initialName,
    email: initialEmail,
    phone: initialPhone,
    company: '',
    tax_id: '',
    address: '',
    lat: '',
    lng: '',
    materials: []
  });
  const [errors, setErrors] = useState({});

  const validateStep1 = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Name is required';
    if (!form.email.trim()) e.email = 'Email is required';
    if (!form.phone.trim()) e.phone = 'Phone is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };
  const validateStep2 = () => {
    const e = {};
    if (!form.company.trim()) e.company = 'Company name is required';
    if (!form.tax_id.trim()) e.tax_id = 'TAX ID is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };
  const validateStep3 = () => {
    const e = {};
    if (!form.address.trim()) e.address = 'Address is required';
    if (!form.lat || !form.lng) e.latlng = 'Location must be selected';
    setErrors(e);
    return Object.keys(e).length === 0;
  };
  const validateStep4 = () => {
    const e = {};
    if (!form.materials.length) e.materials = 'At least one material is required';
    form.materials.forEach((m, i) => {
      if (!m.name || !m.price) e[`material_${i}`] = 'Material and price required';
    });
    setErrors(e);
    return Object.keys(e).length === 0;
  };
  const handleNext = () => {
    let valid = false;
    if (step === 0) valid = validateStep1();
    if (step === 1) valid = validateStep2();
    if (step === 2) valid = validateStep3();
    if (step === 3) valid = validateStep4();
    if (valid) setStep(step + 1);
  };
  const handleBack = () => setStep(step - 1);

  return (
    <div className="onboarding-container" style={boxStyle}>
      <div className="onboarding-progress" style={{ marginBottom: 32, color: '#222', fontWeight: 600, fontSize: 18 }}>
        {steps.map((s, i) => (
          <span key={s} style={{ fontWeight: i === step ? 'bold' : 'normal', marginRight: 18 }}>{i + 1}. {s}</span>
        ))}
      </div>
      {step === 0 && (
        <div>
          <h2 style={{ color: '#222', marginBottom: 18 }}>Basic Info</h2>
          <label style={labelStyle}>Name
            <input style={inputStyle} value={form.name} readOnly />
            {errors.name && <div style={errorStyle}>{errors.name}</div>}
          </label>
          <label style={labelStyle}>Email
            <input style={inputStyle} value={form.email} readOnly />
            {errors.email && <div style={errorStyle}>{errors.email}</div>}
          </label>
          <label style={labelStyle}>Phone
            <input style={inputStyle} value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            {errors.phone && <div style={errorStyle}>{errors.phone}</div>}
          </label>
        </div>
      )}
      {step === 1 && (
        <div>
          <h2 style={{ color: '#222', marginBottom: 18 }}>Company Info</h2>
          <label style={labelStyle}>Company Name
            <input style={inputStyle} value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} />
            {errors.company && <div style={errorStyle}>{errors.company}</div>}
          </label>
          <label style={labelStyle}>TAX ID
            <input style={inputStyle} value={form.tax_id} onChange={e => setForm(f => ({ ...f, tax_id: e.target.value }))} />
            {errors.tax_id && <div style={errorStyle}>{errors.tax_id}</div>}
          </label>
        </div>
      )}
      {step === 2 && (
        <LocationStep form={form} setForm={setForm} errors={errors} inputStyle={inputStyle} labelStyle={labelStyle} errorStyle={errorStyle} />
      )}
      {step === 3 && (
        <div>
          <h2 style={{ color: '#222', marginBottom: 18 }}>Materials</h2>
          <MaterialStep form={form} setForm={setForm} errors={errors} inputStyle={inputStyle} labelStyle={labelStyle} errorStyle={errorStyle} />
        </div>
      )}
      <div style={{ marginTop: 32 }}>
        {step > 0 && <button style={buttonStyle} onClick={handleBack}>Back</button>}
        {step < steps.length - 1 && <button style={buttonStyle} onClick={handleNext}>Next</button>}
        {step === steps.length - 1 && <button style={buttonStyle} onClick={() => { if (validateStep4()) onComplete && onComplete(form); }}>Finish</button>}
      </div>
    </div>
  );
}

function LocationStep({ form, setForm, errors, inputStyle, labelStyle, errorStyle }) {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const geocoderRef = useRef(null);
  const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN;

  useEffect(() => {
    if (!mapboxToken || !mapContainer.current) return;
    if (mapRef.current) return;
    mapboxgl.accessToken = mapboxToken;
    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v11',
      center: [77.209, 28.6139],
      zoom: 4
    });
    mapRef.current = map;
    const geocoder = new MapboxGeocoder({
      accessToken: mapboxToken,
      mapboxgl: mapboxgl,
      marker: false,
      placeholder: 'Search supplier location...'
    });
    geocoderRef.current = geocoder;
    map.addControl(geocoder);
    geocoder.on('result', (e) => {
      const { center, place_name } = e.result;
      setForm(f => ({ ...f, address: place_name, lng: center[0], lat: center[1] }));
      console.log('Supplier selected location (search):', { lat: center[1], lng: center[0] });
      if (markerRef.current) markerRef.current.remove();
      markerRef.current = new mapboxgl.Marker().setLngLat(center).addTo(map);
      map.flyTo({ center, zoom: 12 });
    });
    map.on('click', (e) => {
      const { lng, lat } = e.lngLat;
      setForm(f => ({ ...f, lng, lat }));
      console.log('Supplier selected location (click):', { lat, lng });
      if (markerRef.current) markerRef.current.remove();
      markerRef.current = new mapboxgl.Marker().setLngLat([lng, lat]).addTo(map);
      fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${mapboxToken}`)
        .then(res => res.json())
        .then(data => {
          const place = data.features[0]?.place_name || '';
          setForm(f => ({ ...f, address: place }));
        });
    });
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [mapboxToken, setForm]);

  return (
    <div>
      <h2 style={{ color: '#222', marginBottom: 18 }}>Location</h2>
      <div ref={mapContainer} style={{ width: '100%', height: 340, marginTop: 18, borderRadius: 10, overflow: 'hidden', border: '1px solid #d1d5db' }} />
    </div>
  );
}

function MaterialStep({ form, setForm, errors, inputStyle, labelStyle, errorStyle }) {
  const [materialOptions, setMaterialOptions] = useState([]);
  const [selectedMaterialId, setSelectedMaterialId] = useState('');
  const [materialPrice, setMaterialPrice] = useState('');
  useEffect(() => {
    fetch('http://localhost:5001/materials')
      .then(res => res.json())
      .then(data => {
        const filtered = data.filter(m => !m.model_name);
        setMaterialOptions(filtered);
      });
  }, []);
  const addMaterial = () => {
    if (!selectedMaterialId || !materialPrice) return;
    const material = materialOptions.find(m => String(m.id) === String(selectedMaterialId));
    if (!material) return;
    if (form.materials.some(m => m.id === material.id)) return; // prevent duplicate
    setForm(f => ({ ...f, materials: [...f.materials, { id: material.id, name: material.name, price: materialPrice }] }));
    setSelectedMaterialId('');
    setMaterialPrice('');
  };
  const removeMaterial = idx => {
    setForm(f => ({ ...f, materials: f.materials.filter((_, i) => i !== idx) }));
  };
  return (
    <div>
      <div style={{ marginBottom: 18, display: 'flex', gap: 10 }}>
        <select
          style={{ ...inputStyle, width: '45%' }}
          value={selectedMaterialId}
          onChange={e => setSelectedMaterialId(e.target.value)}
        >
          <option value="">Select material...</option>
          {materialOptions.map(m => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
        <input
          placeholder="Per unit price"
          type="number"
          value={materialPrice}
          onChange={e => setMaterialPrice(e.target.value)}
          style={{ ...inputStyle, width: '40%' }}
        />
        <button type="button" style={{ ...buttonStyle, marginTop: 0 }} onClick={addMaterial}>Add</button>
      </div>
      {errors.materials && <div style={errorStyle}>{errors.materials}</div>}
      {form.materials.map((m, idx) => (
        <div key={idx} style={{ marginBottom: 10, color: '#222', background: '#fff', borderRadius: 6, padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid #e2e8f0' }}>
          <span>{m.name} @ {m.price}</span>
          <button type="button" style={{ ...buttonStyle, padding: '6px 16px', fontSize: 15, marginRight: 0 }} onClick={() => removeMaterial(idx)}>Remove</button>
          {errors[`material_${idx}`] && <div style={errorStyle}>{errors[`material_${idx}`]}</div>}
        </div>
      ))}
    </div>
  );
} 